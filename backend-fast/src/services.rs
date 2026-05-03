use sqlx::{PgPool, Error};

// [Core Business Logic] DB 연동 핵심 로직 (Hot Path)
pub async fn save_image_metadata(pool: &PgPool, user_id: i64, url: &str) -> Result<(), Error> {
    let mut tx = pool.begin().await?;

    // 1. 현재 사용자의 이미지 갯수 확인
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM images WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

    // 2. 100개 이상이면 가장 오래된 것 삭제 (FIFO)
    if count.0 >= 100 {
        // DB 데이터 삭제
        sqlx::query("DELETE FROM images WHERE id = (SELECT id FROM images WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1)")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        
        // TODO: (실제 프로덕션에서는 OCI 스토리지에서도 파일 삭제 API 호출 필요)
    }

    // 3. 새 이미지 데이터 저장
    sqlx::query("INSERT INTO images (user_id, url, created_at) VALUES ($1, $2, NOW())")
        .bind(user_id)
        .bind(url)
        .execute(&mut *tx)
        .await?;
    
    tx.commit().await?;
    Ok(())
}
