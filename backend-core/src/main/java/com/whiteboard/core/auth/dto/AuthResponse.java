package com.whiteboard.core.auth.dto;

public class AuthResponse {
    private String token;
    private String email;
    private String name;
    private String provider;
    private String providerId;

    public AuthResponse(String token, String email, String name) {
        this(token, email, name, "local", null);
    }

    public AuthResponse(String token, String email, String name, String provider, String providerId) {
        this.token = token;
        this.email = email;
        this.name = name;
        this.provider = provider;
        this.providerId = providerId;
    }

    public String getToken() { return token; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public String getProvider() { return provider; }
    public String getProviderId() { return providerId; }
}
