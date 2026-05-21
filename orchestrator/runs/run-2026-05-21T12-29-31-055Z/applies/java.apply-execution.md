You are Codex applying previously approved worker-proposed edits for the Whiteboard Capture repository.
Return only JSON matching the provided schema.
Generate the exact final file content for each changed file.
Do not propose edits outside the listed files.
Preserve existing style and comments where appropriate.
Add concise human-readable comments only where complex logic benefits from them.

Role: java
Goal: Spring Boot 백엔드에 네이버 OAuth2 로그인 연동 및 JWT 발급/인증 플로우 구현

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT 발급 구조와 사용자 식별 계약을 Rust/Web/Mobile과 일치시킵니다.
- application.properties와 .env 기반 환경설정 정책을 유지합니다.
- OAuth provider 연동, 사용자 식별, JWT 발급 구조를 전체 클라이언트와 일치시킵니다.

Required verification:
- .skills/verify-core.ps1

Target file edits:

## backend-core/src/main/resources/application.properties
- action: update
- summary: 네이버 OAuth2 클라이언트 정보를 환경변수 연동 형태로 보강
- instructions:
  - NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_REDIRECT_URI 항목이 없으면 spring.security.oauth2.client.registration.naver.{client-id,client-secret,redirect-uri} 환경변수 바인딩으로 추가
  - application.properties 하단에 아래 형식 추가
  - # Naver OAuth2
  - spring.security.oauth2.client.registration.naver.client-id=${NAVER_CLIENT_ID}
  - spring.security.oauth2.client.registration.naver.client-secret=${NAVER_CLIENT_SECRET}
  - spring.security.oauth2.client.registration.naver.redirect-uri=${NAVER_REDIRECT_URI}
  - spring.security.oauth2.client.registration.naver.authorization-grant-type=authorization_code
  - spring.security.oauth2.client.registration.naver.scope=name,email
- exists: yes

Current file content:
```
# Server configuration
server.port=8080

# Database Configuration (PostgreSQL)
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5433/whiteboard_db}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME:postgres}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:postgres}
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA Configuration
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

# JWT Configuration (Shared with Rust Fast Backend)
jwt.secret=${JWT_SECRET_KEY}
# 24 hours in milliseconds
jwt.expiration-time=86400000

# Naver OAuth2
spring.security.oauth2.client.registration.naver.client-id=${NAVER_CLIENT_ID}
spring.security.oauth2.client.registration.naver.client-secret=${NAVER_CLIENT_SECRET}
spring.security.oauth2.client.registration.naver.redirect-uri=${NAVER_REDIRECT_URI}
spring.security.oauth2.client.registration.naver.authorization-grant-type=authorization_code
spring.security.oauth2.client.registration.naver.client-name=Naver
spring.security.oauth2.client.registration.naver.scope=email,profile,openid

```

## backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java
- action: update
- summary: SecurityConfig에 네이버 OAuth2 client 등록 및 login config 추가
- instructions:
  - http.oauth2Login() 설정을 활성화
  - OAuth2UserService와 SuccessHandler, FailureHandler를 설정
  - 네이버 프로바이더 등록 spring.security.oauth2.client.registration.naver.* 와 연결
  - 기존 JWT 인증 필터와 oauth2Login 공존 유의
- exists: yes

Current file content:
```
package com.whiteboard.core.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    public SecurityConfig(JwtFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/auth/naver/login", "/auth/naver/callback").permitAll()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .oauth2Login(oauth2 ->
                oauth2
                    .loginPage("/api/auth/naver/login")
                    .defaultSuccessUrl("/api/auth/naver/callback", true)
            );
        // OAuth2 클라이언트를 spring oauth2Login 인프라에도 적용.
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}

```

## backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java
- action: update
- summary: 네이버 OAuth2 로그인 엔드포인트 및 콜백 핸들러 구현
- instructions:
  - GET /oauth2/authorization/naver 엔드포인트 추가 (네이버 로그인 리다이렉트용)
  - GET /login/oauth2/code/naver 콜백 엔드포인트 구현
  - 인증 성공시 네이버 API에서 사용자 정보(email, name 등) 받아와 기존 User와 매칭 또는 새로 회원가입
  - JwtUtil 사용해 최초 JWT 발급 및 AuthResponse 반환
- exists: yes

Current file content:
```
package com.whiteboard.core.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.whiteboard.core.auth.dto.AuthRequest;
import com.whiteboard.core.auth.dto.AuthResponse;
import com.whiteboard.core.user.User;
import com.whiteboard.core.user.UserRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${spring.security.oauth2.client.registration.naver.client-id}")
    private String naverClientId;

    @Value("${spring.security.oauth2.client.registration.naver.client-secret}")
    private String naverClientSecret;

    @Value("${spring.security.oauth2.client.registration.naver.redirect-uri}")
    private String naverRedirectUri;

    public AuthController(
            AuthenticationManager authenticationManager,
            JwtUtil jwtUtil,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = new ObjectMapper();
        this.restTemplate = new RestTemplate();
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.badRequest().body("Email already exists");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName() != null ? request.getName() : "Student");
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail(), "local", null);
        return ResponseEntity.ok(new AuthResponse(token, user.getEmail(), user.getName(), "local", null));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        if (!auth.isAuthenticated()) {
            return ResponseEntity.status(401).body("Invalid credentials");
        }

        User user = userRepository.findByEmail(request.getEmail()).orElseThrow();
        String token = jwtUtil.generateToken(user.getEmail(), "local", null);
        return ResponseEntity.ok(new AuthResponse(token, user.getEmail(), user.getName(), "local", null));
    }

    // Redirect the browser to Naver's authorization page. The callback then
    // exchanges the code for a token and issues our shared JWT.
    @GetMapping("/naver/login")
    public void naverLogin(HttpServletResponse response) throws IOException {
        String state = UUID.randomUUID().toString();
        String authorizationUri = UriComponentsBuilder.fromUriString("https://nid.naver.com/oauth2.0/authorize")
                .queryParam("response_type", "code")
                .queryParam("client_id", naverClientId)
                .queryParam("redirect_uri", naverRedirectUri)
                .queryParam("state", state)
                .build()
                .toUriString();
        response.sendRedirect(authorizationUri);
    }

    @GetMapping("/naver/callback")
    public ResponseEntity<?> naverCallback(
            @RequestParam("code") String code,
            @RequestParam("state") String state
    ) throws IOException {
        String tokenUri = UriComponentsBuilder.fromUriString("https://nid.naver.com/oauth2.0/token")
                .queryParam("grant_type", "authorization_code")
                .queryParam("client_id", naverClientId)
                .queryParam("client_secret", naverClientSecret)
                .queryParam("code", code)
                .queryParam("state", state)
                .build()
                .toUriString();

        String tokenResponse = restTemplate.getForObject(tokenUri, String.class);
        JsonNode tokenJson = objectMapper.readTree(tokenResponse);
        String accessToken = tokenJson.has("access_token") ? tokenJson.get("access_token").asText() : null;
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.badRequest().body("Failed to issue Naver access token");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.add("Authorization", "Bearer " + accessToken);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> profileResponse = restTemplate.exchange(
                "https://openapi.naver.com/v1/nid/me",
                HttpMethod.GET,
                entity,
                String.class
        );

        JsonNode profileJson = objectMapper.readTree(profileResponse.getBody());
        JsonNode profile = profileJson.get("response");
        if (profile == null || profile.get("id") == null) {
            return ResponseEntity.badRequest().body("Naver profile response is missing the user id");
        }

        String naverId = profile.get("id").asText();
        String email = profile.hasNonNull("email") ? profile.get("email").asText() : null;
        String name = profile.hasNonNull("name") ? profile.get("name").asText() : "Naver User";

        Optional<User> userOpt = userRepository.findByNaverId(naverId);
        User user = userOpt.orElseGet(() -> {
            User created = new User();
            created.setEmail(email != null ? email : "naver@no.email." + naverId + ".local");
            created.setPassword("");
            created.setName(name);
            created.setNaverId(naverId);
            return created;
        });

        if (user.getNaverId() == null || user.getNaverId().isBlank()) {
            user.setNaverId(naverId);
        }
        if ((user.getEmail() == null || user.getEmail().isBlank()) && email != null) {
            user.setEmail(email);
        }
        if (user.getName() == null || user.getName().isBlank()) {
            user.setName(name);
        }

        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail(), "naver", naverId);
        return ResponseEntity.ok(new AuthResponse(token, user.getEmail(), user.getName(), "naver", naverId));
    }
}

```

## backend-core/src/main/java/com/whiteboard/core/user/User.java
- action: update
- summary: User 엔티티에 provider, providerId 필드 추가
- instructions:
  - private String provider; // ex: naver, google 등
  - private String providerId; // 각 provider의 고유 user 식별자
  - 필요시 JPA @Column 애너테이션으로 필드 매핑
  - 생성자/빌더 등에 신규 필드 반영
  - equals/hashCode 등에 provider, providerId 추가여부 확인
- exists: yes

Current file content:
```
package com.whiteboard.core.user;

import jakarta.persistence.*;
import java.time.LocalDateTime;

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

    // Naver OAuth 로그인용
    @Column(name = "naver_id", unique = true, nullable = true)
    private String naverId;

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
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

```

## backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
- action: update
- summary: provider, providerId 기반 사용자 조회 추가
- instructions:
  - Optional<User> findByProviderAndProviderId(String provider, String providerId);
  - 네이버 OAuth 로그인시 provider, providerId로 사용자를 먼저 찾도록 지원
- exists: yes

Current file content:
```
package com.whiteboard.core.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByGoogleId(String googleId);
    Optional<User> findByNaverId(String naverId);
    boolean existsByEmail(String email);
}

```

## backend-core/src/main/java/com/whiteboard/core/auth/CustomUserDetailsService.java
- action: update
- summary: CustomUserDetailsService가 OAuth2User도 인증 가능하도록 확장
- instructions:
  - UserDetailsService 및 OAuth2UserService 구현
  - 네이버 OAuth2 인증 결과로부터 User 엔티티를 찾거나 새로 생성
  - provider, providerId 필드를 활용
  - UserDetails 및 OAuth2User 반환 타입 유의
- exists: yes

Current file content:
```
package com.whiteboard.core.auth;

import com.whiteboard.core.user.User;
import com.whiteboard.core.user.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        return new org.springframework.security.core.userdetails.User(user.getEmail(), user.getPassword(), new ArrayList<>());
    }
}

```

## backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java
- action: update
- summary: JwtUtil에 OAuth2 사용자(JWT 생성/파싱) 지원 보강
- instructions:
  - User principal에서 provider, providerId 기반의 식별자 JWT에 포함
  - 기존 JWT 발급 로직이 이메일뿐 아니라 provider, providerId와 잘 연동되는지 확인
- exists: yes

Current file content:
```
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

```

Output rules:
- fileEdits must include only the listed paths.
- For update/create actions, content must contain the full final file content.
- For delete actions, content must be an empty string.
- changedFiles should match the files you actually changed.
- status should be succeeded only if the file contents are ready to write.
