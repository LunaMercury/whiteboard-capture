package com.whiteboard.core.user;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String name;

    // Google OAuth 로그인용
    @Column(name = "google_id", unique = true)
    private String googleId;

    // Naver OAuth 로그인용(이전 호환)
    @Column(name = "naver_id", unique = true, nullable = true)
    private String naverId;

    // 통합 OAuth provider(reserved: "local", "naver", "google" 등)
    @Column(name = "provider", nullable = true, length = 50)
    private String provider;

    // provider별 고유 식별자 (예: 네이버id, 구글sub 등)
    @Column(name = "provider_id", nullable = true, length = 100)
    private String providerId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }

    public String getNaverId() { return naverId; }
    public void setNaverId(String naverId) { this.naverId = naverId; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getProviderId() { return providerId; }
    public void setProviderId(String providerId) { this.providerId = providerId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return Objects.equals(email, user.email) &&
                Objects.equals(provider, user.provider) &&
                Objects.equals(providerId, user.providerId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(email, provider, providerId);
    }
}
