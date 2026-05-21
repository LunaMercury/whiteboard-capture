You are Codex applying previously approved worker-proposed edits for the Whiteboard Capture repository.
Return only JSON matching the provided schema.
Generate the exact final file content for each changed file.
Do not propose edits outside the listed files.
Preserve existing style and comments where appropriate.
Add concise human-readable comments only where complex logic benefits from them.

Role: java
Goal: Spring Boot 기반 백엔드에 네이버 OAuth 2.0 소셜 로그인 기능을 추가하여, 네이버 계정으로 로그인 시 JWT를 발급하고 기존 Google/IDPW와 동일하게 사용자 계정과 연동되도록 구현합니다.

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT 발급 구조와 사용자 식별 계약을 Rust/Web/Mobile과 일치시킵니다.
- application.properties와 .env 기반 환경설정 정책을 유지합니다.
- OAuth provider 연동, 사용자 식별, JWT 발급 구조를 전체 클라이언트와 일치시킵니다.

Mandatory policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인

Required verification:
- .skills/verify-core.ps1
- .skills/verify-all.ps1

Target file edits:

## backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java
- action: update
- summary: Spring Security 설정에 네이버 OAuth2 provider/registration 연동 및 OAuth2 로그인 엔드포인트 활성화
- instructions:
  - OAuth2 Client 등록 정보에 NAVER provider 추가(authorizationUri, tokenUri 등 정의)
  - Naver clientId, clientSecret, redirectUri 등 설정을 ENV/application.properties에서 불러오기
  - oauth2Login() 설정에 네이버 연동 엔드포인트 추가
  - 필요시 csrf, cors 등 정책 재확인
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
                .requestMatchers("/api/auth/**", "/oauth2/authorization/naver", "/login/oauth2/code/naver", "/auth/naver/login", "/auth/naver/callback").permitAll()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .oauth2Login(oauth2 ->
                oauth2
                    .loginPage("/api/auth/naver/login")
                    // Spring Security의 OAuth2 SuccessHandler/FailureHandler를 따로 둘 경우 custom으로 주입
                    .defaultSuccessUrl("/api/auth/naver/callback", true)
                // .userInfoEndpoint().userService(oauth2UserService) // OAuth2 통합 인증 서비스 작성시 추가 가능
            );

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
- summary: 네이버 OAuth2 인증 콜백 엔드포인트(/auth/naver/callback 등) 추가 및 JWT 발급 로직 구현
- instructions:
  - 네이버 OAuth2 인증 콜백을 처리하는 @GetMapping 엔드포인트 추가
  - 인증 성공 시 네이버에서 받은 사용자 profile 정보 파싱
  - UserRepository를 통해 provider/providerId로 기존 유저 조회, 없으면 신규 생성
  - JwtUtil로 JWT 토큰을 발급하여 반환
  - 에러처리 및 예외 상황 처리(필요시 로그 추가)
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
        // provider 정보
        user.setProvider("local");
        user.setProviderId(null);
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

    // Spring Security oauth2Login용 진입점. 실제로는 /oauth2/authorization/naver 경로를 사용할 수 있으나, 프락시로 직접 네이버 로그인 리다이렉트 구현.
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

    // OAuth2 서버에서의 콜백 처리. JWT발급, 신규 사용자 등록, provider/providerId 사용
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

        // provider/userId 기반 사용자 검색/생성
        Optional<User> userOpt = userRepository.findByProviderAndProviderId("naver", naverId);
        User user = userOpt.orElseGet(() -> {
            User created = new User();
            created.setEmail(email != null ? email : ("naver@no.email." + naverId + ".local"));
            created.setPassword("");
            created.setName(name);
            created.setProvider("naver");
            created.setProviderId(naverId);
            created.setNaverId(naverId);
            return created;
        });
        // 기존 유저 마이그레이션(과도기용): naverId만 있고 provider null이면 provider 채움
        boolean changed = false;
        if (user.getProvider() == null || user.getProvider().isBlank()) {
            user.setProvider("naver");
            changed = true;
        }
        if (user.getProviderId() == null || user.getProviderId().isBlank()) {
            user.setProviderId(naverId);
            changed = true;
        }
        if ((user.getEmail() == null || user.getEmail().isBlank()) && email != null) {
            user.setEmail(email);
            changed = true;
        }
        if (user.getName() == null || user.getName().isBlank()) {
            user.setName(name);
            changed = true;
        }
        if (user.getNaverId() == null || user.getNaverId().isBlank()) {
            user.setNaverId(naverId);
            changed = true;
        }
        if (changed || user.getId() == null) {
            userRepository.save(user);
        }

        String token = jwtUtil.generateToken(user.getEmail(), "naver", naverId);
        return ResponseEntity.ok(new AuthResponse(token, user.getEmail(), user.getName(), "naver", naverId));
    }
}

```

## backend-core/src/main/java/com/whiteboard/core/user/User.java
- action: update
- summary: User 엔티티에 provider, providerId 필드(및 필요한 getter/setter) 추가
- instructions:
  - provider(String), providerId(String) 필드 추가
  - 해당 필드에 @Column(nullable = true, unique = false) 등 적절한 JPA 어노테이션 부여
  - 기본 생성자, getter/setter, builder에 필드 추가
- exists: yes

Current file content:
```
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

```

## backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
- action: update
- summary: provider/providerId 조합으로 User 엔티티를 조회하는 메서드(add findByProviderAndProviderId)
- instructions:
  - Optional<User> findByProviderAndProviderId(String provider, String providerId) 메서드 추가
  - 기존 id/email 기반 조회 코드는 그대로 유지
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
    Optional<User> findByProviderAndProviderId(String provider, String providerId);
}

```

## backend-core/src/main/java/com/whiteboard/core/auth/CustomUserDetailsService.java
- action: update
- summary: 네이버(provider == 'naver') 등 소셜 로그인 사용자도 처리할 수 있게 UserDetailsService 로직 확장
- instructions:
  - OAuth2AuthenticationToken 기반 인증 처리 시 provider, providerId 활용하도록 로직 보강
  - provider가 naver일 경우 profile 정보에서 id 추출 후 User 조회/생성
  - Google 등 기존 Social 로그인 로직(if any)과 통합/유지
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

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                new ArrayList<>()
        );
    }
}
```

## backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java
- action: update
- summary: JWT 발급/파싱 로직 기존 구조(클레임구조/시크릿/만료정책 등) 유지, 네이버 소셜사용자도 동일방식으로 처리
- instructions:
  - JWT를 생성할 때 provider, providerId 정보(claim)도 포함(타 플랫폼과 claim구조 일치 재확인 필요)
  - 기존 getUsernameFromToken, validateToken 등 코드 변경 최소화
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

```

Output rules:
- fileEdits must include only the listed paths.
- For update/create actions, content must contain the full final file content.
- For delete actions, content must be an empty string.
- changedFiles should match the files you actually changed.
- Treat every mandatory policy check as a hard requirement when generating final file content.
- status should be succeeded only if the file contents are ready to write.
