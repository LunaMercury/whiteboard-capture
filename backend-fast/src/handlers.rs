use crate::{services, AppState, ImageEvent};
use axum::{
    extract::{ws::Message, Multipart, Path, Query, State, WebSocketUpgrade},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::path::{Path as FsPath, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

// Claims can contain extra fields such as 'provider' for Naver/Kakao/etc social logins
// due to the flatten in services.rs. This ensures JWTs from any provider are accepted
// as long as the signature and 'sub' are correct.
pub use crate::services::Claims;

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
    // Provider-specific JWTs (e.g. 'provider: naver') are accepted as long as JWT is valid.
    let user_id = match authenticate_request(&headers, &state).await {
        Ok(user_id) => user_id,
        Err(status) => return status.into_response(),
    };

    let mut file_path: Option<PathBuf> = None;
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
        let user_dir = FsPath::new(&state.upload_dir).join(user_id.to_string());
        if let Err(error) = tokio::fs::create_dir_all(&user_dir).await {
            eprintln!("Failed to create upload directory {:?}: {:?}", user_dir, error);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }

        let next_file_path = user_dir.join(&filename);

        let data = match field.bytes().await {
            Ok(data) => data,
            Err(error) => {
                eprintln!("Failed to read multipart image bytes: {:?}", error);
                return StatusCode::BAD_REQUEST.into_response();
            }
        };

        let mut file = match File::create(&next_file_path).await {
            Ok(file) => file,
            Err(error) => {
                eprintln!("Failed to create upload file {:?}: {:?}", next_file_path, error);
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        };

        if let Err(error) = file.write_all(&data).await {
            eprintln!("Failed to write upload file {:?}: {:?}", next_file_path, error);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }

        file_path = Some(next_file_path);
        break;
    }

    let file_path = match file_path {
        Some(path) => path,
        None => {
            return StatusCode::BAD_REQUEST.into_response();
        }
    };

    if filename.is_empty() {
        return StatusCode::BAD_REQUEST.into_response();
    }

    let real_image_url = format!("{}/uploads/{}/{}", state.public_base_url.trim_end_matches('/'), user_id, filename);

    match services::save_image_metadata(&state.db, user_id, &real_image_url).await {
        Ok(deleted_url) => {
            // When FIFO evicts an old record, delete the matching local file in the same request flow.
            if let Some(old_url) = deleted_url {
                let _ = delete_local_file_from_url(&state.upload_dir, &old_url).await;
            }

            let _ = state.tx.send(ImageEvent {
                user_id,
                url: real_image_url.clone(),
            });

            (StatusCode::OK, "Upload Success").into_response()
        }
        Err(error) => {
            eprintln!("DB Error during upload: {:?}", error);
            let _ = tokio::fs::remove_file(&file_path).await;
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WebSocketAuthQuery>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // JWT is accepted regardless of social provider; only signature and user existence are checked.
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

        let message = format!(r#"{{\"type\":\"new_image\",\"url\":\"{}\"}}"#, event.url);
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
    // Provider-specific JWTs (e.g. 'provider: naver') are accepted as long as JWT is valid and contains 'sub'.
    // If 'provider' is present in JWT claims, we simply ignore it.
    let claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?
    .claims;

    // Optionally log provider field for debugging/social provider analytics
    if let Some(_provider) = claims.extra.get("provider").and_then(|v| v.as_str()) {
        // eprintln!("JWT provider: {}", _provider);
        // For production, remove or redirect this log to structured telemetry if needed.
    }

    let user_id = services::find_user_id_by_email(&state.db, &claims.sub)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    Ok(user_id)
}

async fn delete_local_file_from_url(upload_dir: &str, url: &str) -> std::io::Result<()> {
    if let Some(filename) = url.rsplit("/uploads/").next() {
        let path = FsPath::new(upload_dir).join(filename);
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
                let local_path = url_to_local_path(&state.upload_dir, &record.url);
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
/// into the local relative path `{upload_dir}/1/file.jpg`.
fn url_to_local_path(upload_dir: &str, url: &str) -> String {
    url.splitn(2, "/uploads/")
        .nth(1)
        .map(|rest| FsPath::new(upload_dir).join(rest).to_string_lossy().into_owned())
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
            let path = url_to_local_path(&state.upload_dir, &url);
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
