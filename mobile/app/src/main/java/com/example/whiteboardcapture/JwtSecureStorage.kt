package com.example.whiteboardcapture

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * JWT 토큰을 보안 저장소(EncryptedSharedPreferences)에 저장/조회/삭제하는 유틸리티 싱글턴
 */
object JwtSecureStorage {
    private const val SECURE_PREFS_NAME = "secure_auth_prefs"
    private const val LEGACY_PREFS_NAME = "auth_prefs"
    private const val TOKEN_KEY = "jwt_token"

    private fun getSecurePrefs(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            SECURE_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveToken(context: Context, token: String) {
        getSecurePrefs(context)
            .edit()
            .putString(TOKEN_KEY, token)
            .apply()
    }

    fun getToken(context: Context): String? {
        val securePrefs = getSecurePrefs(context)
        val secureToken = securePrefs.getString(TOKEN_KEY, null)
        if (!secureToken.isNullOrBlank()) {
            return secureToken
        }

        return migrateLegacyToken(context, securePrefs)
    }

    fun clearToken(context: Context) {
        getSecurePrefs(context).edit().remove(TOKEN_KEY).apply()
        context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(TOKEN_KEY)
            .apply()
    }

    private fun migrateLegacyToken(context: Context, securePrefs: SharedPreferences): String? {
        val legacyPrefs = context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
        val legacyToken = legacyPrefs.getString(TOKEN_KEY, null)
        if (legacyToken.isNullOrBlank()) {
            return null
        }

        securePrefs.edit().putString(TOKEN_KEY, legacyToken).apply()
        legacyPrefs.edit().remove(TOKEN_KEY).apply()
        return legacyToken
    }
}
