mod handlers;
mod services;

use axum::{
    http::{header, HeaderValue, Method},
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

#[derive(Clone, Debug)]
pub struct ImageEvent {
    pub user_id: i64,
    pub url: String,
}

pub struct AppState {
    pub db: sqlx::PgPool,
    pub jwt_secret: String,
    pub public_base_url: String,
    pub tx: broadcast::Sender<ImageEvent>,
}

#[tokio::main]
async fn main() {
    println!("Starting Whiteboard Capture Rust Fast Backend...");

    let _ = tokio::fs::create_dir_all("uploads").await;

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5433/whiteboard_db".to_string());

    let jwt_secret = std::env::var("JWT_SECRET_KEY")
        .expect("JWT_SECRET_KEY must be configured for the Rust fast backend");

    // The upload API can stay private while the browser still needs a public URL for copied images.
    let public_base_url = std::env::var("PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());

    let allowed_origins = std::env::var("ALLOWED_WEB_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await
        .expect("Failed to connect to Postgres");

    println!("Database connected successfully.");

    let (tx, _rx) = broadcast::channel(100);
    let state = Arc::new(AppState {
        db: pool,
        jwt_secret,
        public_base_url,
        tx,
    });

    let allow_origin_values = allowed_origins
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(HeaderValue::from_str)
        .collect::<Result<Vec<_>, _>>()
        .expect("ALLOWED_WEB_ORIGINS contains an invalid origin");

    let cors = CorsLayer::new()
        .allow_origin(allow_origin_values)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);

    let app = Router::new()
        .route("/upload", post(handlers::upload_image))
        .route("/ws", get(handlers::ws_handler))
        .nest_service("/uploads", ServeDir::new("uploads"))
        .with_state(state)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Listening on port 3000 (Hot Path Pipeline)");
    axum::serve(listener, app).await.unwrap();
}
