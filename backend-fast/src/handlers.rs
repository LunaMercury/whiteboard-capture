use crate::{services, AppState, ImageEvent};
use axum::{
    extract::{ws::Message, Multipart, Path, Query, State, WebSocketUpgrade},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
}

#[derive(Debug, Deserialize)]
pub struct WebSocketAuthQuery {
    token: String,
}

pub async fn upload_image(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> impl IntoResponse {
    // The hot path only accepts authenticated uploads so each image is routed to the right user.
    let user_id = match authenticate_request(&headers, &state).await {
        Ok(user_id) => user_id,
        Err(status) => return status.into_response(),
    };

    let mut file_path = String::new();
    let mut filename = String::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() != Some("image") {
            continue;
        }

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();

        filename = format!("{}.jpg", timestamp);
        let user_dir = format!("uploads/{}", user_id);
        let _ = tokio::fs::create_dir_all(&user_dir).await;
        file_path = format!("{}/{}", user_dir, filename);

        if let Ok(data) = field.bytes().await {
            if let Ok(mut file) = File::create(&file_path).await {
                let _ = file.write_all(&data).await;
            }
        }
        break;
    }

    if file_path.is_empty() {
        return StatusCode::BAD_REQUEST.into_response();
    }

    let real_image_url = format!("{}/uploads/{}/{}", state.public_base_url.trim_end_matches('/'), user_id, filename);

    match services::save_image_metadata(&state.db, user_id, &real_image_url).await {
        Ok(deleted_url) => {
            // When FIFO evicts an old record, delete the matching local file in the same request flow.
            if let Some(old_url) = deleted_url {
                let _ = delete_local_file_from_url(&old_url).await;
            }

            let _ = state.tx.send(ImageEvent {
                user_id,
                url: real_image_url.clone(),
            });

            (StatusCode::OK, "Upload Success").into_response()
        }
        Err(error) => {
            eprintln!("DB Error during upload: {:?}", error);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WebSocketAuthQuery>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let user_id = match authenticate_token(&query.token, &state).await {
        Ok(user_id) => user_id,
        Err(status) => return status.into_response(),
    };

    // Each socket subscribes to the shared broadcast stream but only forwards its own user's events.
    ws.on_upgrade(move |socket| handle_socket(socket, state, user_id))
}

async fn handle_socket(mut socket: axum::extract::ws::WebSocket, state: Arc<AppState>, user_id: i64) {
    let mut rx = state.tx.subscribe();

    while let Ok(event) = rx.recv().await {
        if event.user_id != user_id {
            continue;
        }

        let message = format!(r#"{{"type":"new_image","url":"{}"}}"#, event.url);
        if socket.send(Message::Text(message.into())).await.is_err() {
            println!("Client disconnected.");
            break;
        }
    }
}

async fn authenticate_request(headers: &HeaderMap, state: &AppState) -> Result<i64, StatusCode> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|value| value.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    authenticate_token(token, state).await
}

async fn authenticate_token(token: &str, state: &AppState) -> Result<i64, StatusCode> {
    // Spring issues the JWT, but Rust resolves the email back to a user id for DB writes and fan-out.
    let claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?
    .claims;

    let user_id = services::find_user_id_by_email(&state.db, &claims.sub)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    Ok(user_id)
}

async fn delete_local_file_from_url(url: &str) -> std::io::Result<()> {
    if let Some(filename) = url.rsplit("/uploads/").next() {
        let path = format!("uploads/{}", filename);
        tokio::fs::remove_file(path).await?;
    }

    Ok(())
}

pub async fn get_images(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match authenticate_request(&headers, &state).await {
        Ok(user_id) => user_id,
        Err(status) => return status.into_response(),
    };

    match services::get_images_by_user(&state.db, user_id).await {
        Ok(records) => {
            // Filter records by whether the file actually exists on disk.
            // Orphaned DB rows (file was deleted externally) are cleaned up eagerly.
            let mut valid = Vec::new();
            let mut orphan_ids: Vec<i64> = Vec::new();

            for record in records {
                let local_path = url_to_local_path(&record.url);
                if tokio::fs::metadata(&local_path).await.is_ok() {
                    valid.push(record);
                } else {
                    eprintln!("Orphan record id={} path={} — queuing for cleanup", record.id, local_path);
                    orphan_ids.push(record.id);
                }
            }

            if !orphan_ids.is_empty() {
                if let Err(e) = services::delete_images_by_ids(&state.db, &orphan_ids).await {
                    eprintln!("Failed to delete orphan records: {:?}", e);
                } else {
                    println!("Cleaned up {} orphan DB record(s).", orphan_ids.len());
                }
            }

            (StatusCode::OK, axum::Json(valid)).into_response()
        }
        Err(error) => {
            eprintln!("DB Error during fetching images: {:?}", error);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Converts a stored public URL like `http://host/uploads/1/file.jpg`
/// into the local relative path `uploads/1/file.jpg`.
fn url_to_local_path(url: &str) -> String {
    url.splitn(2, "/uploads/")
        .nth(1)
        .map(|rest| format!("uploads/{}", rest))
        .unwrap_or_else(|| url.to_string())
}

pub async fn delete_image(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(image_id): Path<i64>,
) -> impl IntoResponse {
    let user_id = match authenticate_request(&headers, &state).await {
        Ok(user_id) => user_id,
        Err(status) => return status.into_response(),
    };

    // Verify the image belongs to the requesting user before deleting.
    match services::get_image_url_if_owner(&state.db, image_id, user_id).await {
        Ok(Some(url)) => {
            // Remove file from disk (best-effort).
            let path = url_to_local_path(&url);
            let _ = tokio::fs::remove_file(&path).await;

            // Remove DB record.
            match services::delete_images_by_ids(&state.db, &[image_id]).await {
                Ok(_) => StatusCode::NO_CONTENT.into_response(),
                Err(e) => {
                    eprintln!("DB delete failed for image {}: {:?}", image_id, e);
                    StatusCode::INTERNAL_SERVER_ERROR.into_response()
                }
            }
        }
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(e) => {
            eprintln!("DB error checking ownership for image {}: {:?}", image_id, e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}
