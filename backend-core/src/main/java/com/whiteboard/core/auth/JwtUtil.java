package com.whiteboard.core.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-time}")
    private long expirationTime;

    @PostConstruct
    void validateConfiguration() {
        // Reject weak or missing secrets early so both Spring and Rust stay in sync.
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET_KEY must be configured");
        }

        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET_KEY must be at least 32 bytes for HS256");
        }
    }

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * JWT 서명 페이로드 생성 (Rust/Web/JVM 동일 구조: sub, provider, provider_id)
     */
    public String generateToken(String email) {
        return generateToken(email, "local", null);
    }

    public String generateToken(String email, String provider, String providerId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("provider", provider);
        if (providerId != null && !providerId.isBlank()) {
            claims.put("provider_id", providerId);
        }

        return Jwts.builder()
                .setSubject(email)
                .addClaims(claims)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expirationTime))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String extractProvider(String token) {
        return (String) extractAllClaims(token).get("provider");
    }

    public String extractProviderId(String token) {
        Object pid = extractAllClaims(token).get("provider_id");
        return pid == null ? null : pid.toString();
    }

    public boolean validateToken(String token, String email) {
        final String extractedEmail = extractEmail(token);
        return extractedEmail.equals(email) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractAllClaims(token).getExpiration().before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
