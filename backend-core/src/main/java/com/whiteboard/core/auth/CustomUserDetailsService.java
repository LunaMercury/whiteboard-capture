package com.whiteboard.core.auth;

import com.whiteboard.core.user.User;
import com.whiteboard.core.user.UserRepository;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Optional;

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

    /**
     * 소셜(OAuth2) 로그인을 위한 Provider 처리 로직 예시.
     * Spring Security 자동 처리에 위임하는 경우 본 메소드는 사용되지 않지만,
     * Custom OAuth2UserService와 함께 사용할 때 참고할 수 있음.
     */
    public UserDetails loadUserByOAuth2AuthenticationToken(Authentication auth) throws UsernameNotFoundException {
        if (auth instanceof OAuth2AuthenticationToken oauth2Auth) {
            String provider = oauth2Auth.getAuthorizedClientRegistrationId();
            String providerId = null;
            String email = null;
            // 네이버/구글 등 provider 별로 principal 구조 다를 수 있음
            Object principalObj = oauth2Auth.getPrincipal().getAttributes();
            if ("naver".equals(provider)) {
                // Naver는 response.id 및 response.email
                var attrsMap = (java.util.Map<String, Object>) principalObj;
                if (attrsMap.containsKey("response")) {
                    var resp = (java.util.Map<String, Object>) attrsMap.get("response");
                    providerId = resp.get("id").toString();
                    email = resp.containsKey("email") ? resp.get("email").toString() : null;
                }
            } else if ("google".equals(provider)) {
                // 구글은 sub, email
                var attrsMap = (java.util.Map<String, Object>) principalObj;
                providerId = attrsMap.get("sub") != null ? attrsMap.get("sub").toString() : null;
                email = attrsMap.get("email") != null ? attrsMap.get("email").toString() : null;
            }
            if (providerId == null) {
                throw new UsernameNotFoundException("No providerId from OAuth2 provider");
            }
            Optional<User> userOpt = userRepository.findByProviderAndProviderId(provider, providerId);
            User user = userOpt.orElseThrow(() -> new UsernameNotFoundException("User not found with provider/providerId"));
            return new org.springframework.security.core.userdetails.User(
                    user.getEmail(),
                    user.getPassword() == null ? "" : user.getPassword(),
                    new ArrayList<GrantedAuthority>()
            );
        }
        throw new UsernameNotFoundException("Authentication not OAuth2 type");
    }
}
