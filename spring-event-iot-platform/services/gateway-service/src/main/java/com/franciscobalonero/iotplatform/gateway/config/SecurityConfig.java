package com.franciscobalonero.iotplatform.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.security.Principal;
import java.util.List;
import java.util.Objects;

/**
 * Security configuration for the API Gateway.
 * Configures the resource server to validate JWT tokens for incoming requests using a shared secret.
 *
 * @author Francisco Balonero Olivera
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Value("${jwt.secret}")
    private String secret;

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        http
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeExchange(exchanges -> exchanges
                // Allow CORS preflight without authentication
                .pathMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                .pathMatchers("/api/v1/auth/login", "/api/v1/auth/register", "/v3/api-docs/**", "/swagger-ui/**", "/webjars/**").permitAll()
                .pathMatchers("/actuator/**").permitAll()
                .pathMatchers("/api/v1/discovery/**").permitAll()
                .pathMatchers("/api/v1/ml/train/**").hasRole("ADMIN")
                // Destructive / global-config operations are admin-only; self-registered users get read access.
                .pathMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/rules/**").hasRole("ADMIN")
                .pathMatchers(org.springframework.http.HttpMethod.DELETE, "/api/v1/devices/**", "/api/v1/areas/**").hasRole("ADMIN")
                .anyExchange().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(grantedAuthoritiesExtractor()))
            );
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public org.springframework.core.convert.converter.Converter<org.springframework.security.oauth2.jwt.Jwt, reactor.core.publisher.Mono<org.springframework.security.authentication.AbstractAuthenticationToken>> grantedAuthoritiesExtractor() {
        org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverter converter =
                new org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverter();

        org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter authoritiesConverter =
                new org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter();
        // Roles in the JWT are already stored with ROLE_ prefix (e.g. "ROLE_ADMIN"),
        // so we set an empty prefix to avoid doubling it to "ROLE_ROLE_ADMIN".
        authoritiesConverter.setAuthorityPrefix("");
        authoritiesConverter.setAuthoritiesClaimName("roles");

        converter.setJwtGrantedAuthoritiesConverter(new org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtGrantedAuthoritiesConverterAdapter(authoritiesConverter));
        return converter;
    }

    @Bean
    public ReactiveJwtDecoder jwtDecoder() {
        byte[] decodedKey = Decoders.BASE64.decode(secret);
        return NimbusReactiveJwtDecoder.withSecretKey(Keys.hmacShaKeyFor(decodedKey)).build();
    }

    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> exchange.getPrincipal()
                .map(Principal::getName)
                .switchIfEmpty(Mono.fromCallable(() -> {
                    var addr = exchange.getRequest().getRemoteAddress();
                    return addr != null ? addr.getAddress().getHostAddress() : "unknown";
                }));
    }
}
