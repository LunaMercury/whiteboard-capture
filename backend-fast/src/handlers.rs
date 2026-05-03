use crate::AppState;
use axum::{
    extract::{Multipart, State, WebSocketUpgrade, ws::WebSocket},
    response::IntoResponse,
};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

// [Hot Path 1]: 모바일 앱에서 사진을 찍었을 때 호출되는 엔드포인트
pub async fn upload_image(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut file_path = String::new();
    let mut filename = String::new();
    
    // [로직] 1. Multipart 데이터에서 이미지 바이트 추출 후 로컬 디스크에 임시 저장
    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("image") {
            let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
            filename = format!("{}.jpg", timestamp);
            file_path = format!("uploads/{}", filename);
            
            if let Ok(data) = field.bytes().await {
                if let Ok(mut file) = File::create(&file_path).await {
                    let _ = file.write_all(&data).await;
                }
            }
            break;
        }
    }

    if file_path.is_empty() {
        return "No image found".into_response();
    }

    // [스토리지] 추후 OCI Object Storage URL로 대체될 부분입니다.
    let real_image_url = format!("http://localhost:3000/uploads/{}", filename);
    let user_id = 1; // 테스트용 하드코딩 유저 ID

    // [DB] 2. DB 트랜잭션: 100개 제한 FIFO 검사 및 메타데이터 Insert
    match crate::services::save_image_metadata(&state.db, user_id, &real_image_url).await {
        Ok(_) => {
            // [실시간 알림] 3. 저장 성공 시, 해당 유저의 WebSocket으로 새 사진이 생겼다고 브로드캐스트
            let msg = format!("{{\"type\": \"new_image\", \"url\": \"{}\"}}", real_image_url);
            let _ = state.tx.send(msg);
            
            "Upload Success".into_response()
        }
        Err(e) => {
            eprintln!("❌ DB Error during upload: {:?}", e);
            "Upload Failed".into_response()
        }
    }
}

// [Hot Path 2]: 웹 프론트엔드가 접속을 유지하는 실시간 파이프라인
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.tx.subscribe();
    
    // 브로드캐스트 채널에서 메시지를 받으면 WebSocket 클라이언트로 즉시 전송
    while let Ok(msg) = rx.recv().await {
        if socket.send(axum::extract::ws::Message::Text(msg)).await.is_err() {
            println!("Client disconnected.");
            break;
        }
    }
}
