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
