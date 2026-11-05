package com.franciscobalonero.iotplatform.auth.service;

import com.franciscobalonero.iotplatform.auth.model.User;
import com.franciscobalonero.iotplatform.auth.repository.UserRepository;
import com.franciscobalonero.iotplatform.auth.util.JwtUtil;
import com.franciscobalonero.iotplatform.common.exception.ConflictException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;

/**
 * Service responsible for user authentication and registration.
 * Creates a default {@code admin} account on first startup if none exists.
 *
 * @author Francisco Balonero Olivera
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    /** Bootstrap admin account; override with ADMIN_USERNAME / ADMIN_PASSWORD (required in docker-compose). */
    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.password:admin123}")
    private String adminPassword;

    /** Ensures the bootstrap admin user exists after the application context is ready. */
    @PostConstruct
    public void init() {
        if (userRepository.findByUsername(adminUsername).isEmpty()) {
            userRepository.save(User.builder()
                    .username(adminUsername)
                    .password(passwordEncoder.encode(adminPassword))
                    .roles(Set.of("ROLE_ADMIN"))
                    .build());
        }
    }

    /**
     * Authenticates a user and returns a signed JWT token.
     *
     * @param username The username to authenticate.
     * @param password The plain-text password to verify.
     * @return A JWT token string on successful authentication.
     * @throws BadCredentialsException if the username does not exist or the password is incorrect.
     */
    public String login(String username, String password) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new BadCredentialsException("Invalid username or password");
        }
        return jwtUtil.generateToken(username, user.getRoles());
    }

    /**
     * Registers a new user with the {@code ROLE_USER} role.
     *
     * @param username The desired username.
     * @param password The plain-text password (will be encoded before storage).
     * @throws ConflictException if the username is already taken.
     */
    public void register(String username, String password) {
        if (userRepository.findByUsername(username).isPresent()) {
            throw new ConflictException("User already exists");
        }

        userRepository.save(User.builder()
                .username(username)
                .password(passwordEncoder.encode(password))
                .roles(Set.of("ROLE_USER"))
                .build());
    }
}
