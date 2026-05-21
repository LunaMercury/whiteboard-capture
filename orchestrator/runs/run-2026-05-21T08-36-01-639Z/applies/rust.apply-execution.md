You are Codex applying previously approved worker-proposed edits for the Whiteboard Capture repository.
Return only JSON matching the provided schema.
Generate the exact final file content for each changed file.
Do not propose edits outside the listed files.
Preserve existing style and comments where appropriate.
Add concise human-readable comments only where complex logic benefits from them.

Role: rust
Goal: 네이버 소셜 로그인을 도입할 때 Rust(Rapid Backend)가 JWT 검증 및 업로드/웹소켓 경로 보호에 대해 정책 및 구현 호환성을 검토하고, 필요한 계약 검증 포인트를 제시합니다.

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT_SECRET_KEY, ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 계약을 유지합니다.
- 업로드 hot path와 websocket fan-out의 성능 특성을 해치지 않습니다.
- JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring 발급 토큰과 일치해야 합니다.

Required verification:
- .skills/verify-fast.ps1
- .skills/verify-all.ps1

Target file edits:

## backend-fast/src/services.rs
- action: update
- summary: Make JWT verification logic robust to presence of social provider-specific claims. Ensure parsing doesn't fail when 'provider' or new non-breaking fields are added.
- instructions:
  - In the JWT parsing/claim deserialization code, change strict struct mapping to allow unknown fields (e.g., by using serde's #[serde(flatten)] or similar).
  - Log/handle presence of a 'provider' field so future claims don't break parsing.
  - Add comments documenting that new social login claims (like 'provider') may be present and should not break verification.
- exists: yes

Current file content:
```
use sqlx::{Error, PgPool};

pub async fn find_user_id_by_email(pool: &PgPool, email: &str) -> Result<i64, Error> {
    let result: (i64,) = sqlx::query_as("SELECT id FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(pool)
        .await?;

    Ok(result.0)
}

pub async fn save_image_metadata(pool: &PgPool, user_id: i64, url: &str) -> Result<Option<String>, Error> {
    let mut tx = pool.begin().await?;

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM images WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

    let mut deleted_url = None;

    if count.0 >= 100 {
        // Fetch the victim row first so the caller can remove the matching file after commit.
        let oldest = sqlx::query_as::<_, (i64, String)>(
            "SELECT id, url FROM images WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1"
        )
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some((image_id, old_url)) = oldest {
            sqlx::query("DELETE FROM images WHERE id = $1")
                .bind(image_id)
                .execute(&mut *tx)
                .await?;
            deleted_url = Some(old_url);
        }
    }

    sqlx::query("INSERT INTO images (user_id, url, created_at) VALUES ($1, $2, NOW())")
        .bind(user_id)
        .bind(url)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(deleted_url)
}

#[derive(sqlx::FromRow, serde::Serialize)]
pub struct ImageRecord {
    pub id: i64,
    pub url: String,
    // DB stores timestamp without timezone; we map to NaiveDateTime and serialize as ISO 8601.
    pub created_at: chrono::NaiveDateTime,
}

pub async fn get_images_by_user(pool: &PgPool, user_id: i64) -> Result<Vec<ImageRecord>, Error> {
    let records = sqlx::query_as::<_, ImageRecord>(
        "SELECT id, url, created_at FROM images WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(records)
}

/// Bulk-deletes image records whose files no longer exist on disk.
pub async fn delete_images_by_ids(pool: &PgPool, ids: &[i64]) -> Result<(), Error> {
    sqlx::query("DELETE FROM images WHERE id = ANY($1)")
        .bind(ids)
        .execute(pool)
        .await?;

    Ok(())
}

/// Returns the URL of an image only when it belongs to the specified user.
/// Returns Ok(None) when the image doesn't exist or belongs to another user.
pub async fn get_image_url_if_owner(
    pool: &PgPool,
    image_id: i64,
    user_id: i64,
) -> Result<Option<String>, Error> {
    let result: Option<(String,)> = sqlx::query_as(
        "SELECT url FROM images WHERE id = $1 AND user_id = $2",
    )
    .bind(image_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(result.map(|(url,)| url))
}

```

## backend-fast/src/handlers.rs
- action: update
- summary: Ensure endpoint guards (upload, websocket) do not filter by any specific social provider and simply rely on JWT validity.
- instructions:
  - Review authentication guard/middleware for upload/websocket endpoints to ensure they check JWT validity, not the specific 'provider'.
  - Add comments/tests to confirm acceptance of JWTs with 'provider: naver' or similar values.
- exists: yes

Current file content:
```
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

```

Output rules:
- fileEdits must include only the listed paths.
- For update/create actions, content must contain the full final file content.
- For delete actions, content must be an empty string.
- changedFiles should match the files you actually changed.
- status should be succeeded only if the file contents are ready to write.
