package com.franciscobalonero.iotplatform.auth.service;

import com.franciscobalonero.iotplatform.auth.model.User;
import com.franciscobalonero.iotplatform.auth.repository.UserRepository;
import com.franciscobalonero.iotplatform.auth.util.JwtUtil;
import com.franciscobalonero.iotplatform.common.exception.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AuthService}.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthService authService;

    private static final String ADMIN    = "admin";
    private static final String ENCODED  = "$2a$10$hashedpwd";
    private static final String RAW_PASS  = "admin123";
    private static final String JWT_TOK  = "jwt.token.value";

    @BeforeEach
    void setUpAdminCredentials() {
        // @Value fields are not populated by Mockito
        ReflectionTestUtils.setField(authService, "adminUsername", ADMIN);
        ReflectionTestUtils.setField(authService, "adminPassword", RAW_PASS);
    }

    // ── init() ───────────────────────────────────────────────────────────────────

    @Test
    void shouldCreateAdminOnInitWhenNoneExists() {
        when(userRepository.findByUsername(ADMIN)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(RAW_PASS)).thenReturn(ENCODED);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        authService.init();

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getUsername()).isEqualTo(ADMIN);
        assertThat(captor.getValue().getRoles()).contains("ROLE_ADMIN");
    }

    @Test
    void shouldNotDuplicateAdminIfAlreadyExists() {
        User existing = User.builder().username(ADMIN).password(ENCODED).roles(Set.of("ROLE_ADMIN")).build();
        when(userRepository.findByUsername(ADMIN)).thenReturn(Optional.of(existing));

        authService.init();

        verify(userRepository, never()).save(any());
    }

    // ── login() ──────────────────────────────────────────────────────────────────

    @Test
    void shouldReturnTokenOnValidLogin() {
        User user = User.builder().username(ADMIN).password(ENCODED).roles(Set.of("ROLE_ADMIN")).build();
        when(userRepository.findByUsername(ADMIN)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(RAW_PASS, ENCODED)).thenReturn(true);
        when(jwtUtil.generateToken(eq(ADMIN), any())).thenReturn(JWT_TOK);

        String token = authService.login(ADMIN, RAW_PASS);

        assertThat(token).isEqualTo(JWT_TOK);
    }

    @Test
    void shouldThrowBadCredentialsWhenUserNotFound() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login("ghost", RAW_PASS))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void shouldThrowBadCredentialsWhenPasswordWrong() {
        User user = User.builder().username(ADMIN).password(ENCODED).roles(Set.of("ROLE_ADMIN")).build();
        when(userRepository.findByUsername(ADMIN)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), eq(ENCODED))).thenReturn(false);

        assertThatThrownBy(() -> authService.login(ADMIN, "wrongpwd"))
                .isInstanceOf(BadCredentialsException.class);
    }

    // ── register() ───────────────────────────────────────────────────────────────

    @Test
    void shouldRegisterNewUser() {
        when(userRepository.findByUsername("newuser")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("pass123")).thenReturn(ENCODED);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        authService.register("newuser", "pass123");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getUsername()).isEqualTo("newuser");
        assertThat(captor.getValue().getRoles()).contains("ROLE_USER");
    }

    @Test
    void shouldThrowConflictWhenUsernameAlreadyTaken() {
        User existing = User.builder().username("taken").password(ENCODED).build();
        when(userRepository.findByUsername("taken")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> authService.register("taken", "pass"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void shouldEncodePasswordBeforeSaving() {
        when(userRepository.findByUsername("enc-user")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("rawpass")).thenReturn("$2a$hashed");
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        authService.register("enc-user", "rawpass");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getPassword()).isEqualTo("$2a$hashed");
    }
}
