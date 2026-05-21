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
