mod handlers;
mod services;

use axum::{
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

pub struct AppState {
    pub db: sqlx::PgPool,
    pub tx: broadcast::Sender<String>, // WebSocket 전송용 채널
}

#[tokio::main]
async fn main() {
    println!("🚀 Starting Whiteboard Capture Rust Fast Backend...");

    // 업로드 폴더 자동 생성
    let _ = tokio::fs::create_dir_all("uploads").await;

    // 1. PostgreSQL 연결 (Docker 컨테이너 포트 5433으로 포워딩)
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5433/whiteboard_db".to_string());
    
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await
        .expect("❌ Failed to connect to Postgres");
    
    println!("✅ Database connected successfully.");

    // 2. WebSocket 브로드캐스트 채널 생성 (모바일에서 업로드하면 웹으로 쏴주기 위함)
    let (tx, _rx) = broadcast::channel(100);

    let state = Arc::new(AppState { db: pool, tx });

    // 3. 라우팅 (API 설계)
    let app = Router::new()
        .route("/upload", post(handlers::upload_image))
        .route("/ws", get(handlers::ws_handler))
        .nest_service("/uploads", ServeDir::new("uploads"))
        .with_state(state)
        .layer(CorsLayer::permissive()); // 개발용 임시 CORS 허용

    // 4. 서버 구동
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("🎧 Listening on port 3000 (Hot Path Pipeline)");
    axum::serve(listener, app).await.unwrap();
}
