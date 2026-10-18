package com.dinomutation.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.player.Player;
import com.dinomutation.player.PlayerRepository;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Two sign-ups with the same e-mail at once both pass existsByEmail; the loser hits the unique
 * constraint on insert and must still get EMAIL_TAKEN (not the generic CONFLICT).
 */
class AuthServiceRegisterRaceTest {

	@Test
	void uniqueEmailViolationOnInsertIsEmailTaken() {
		PlayerRepository players = mock(PlayerRepository.class);
		when(players.existsByEmail("pedro@example.com")).thenReturn(false);
		when(players.saveAndFlush(any(Player.class)))
				.thenThrow(new DataIntegrityViolationException("duplicate key value violates unique constraint"));
		AuthService auth = new AuthService(players, mock(PasswordEncoder.class), mock(AccessTokenService.class),
				mock(RefreshTokenService.class), Clock.systemUTC(), mock(GoogleTokenVerifier.class));

		assertThatThrownBy(() -> auth.register(new RegisterRequest("pedro@example.com", "senha-forte-123", "Pedro")))
				.isInstanceOfSatisfying(ApiException.class, e -> {
					assertThat(e.code()).isEqualTo(ErrorCode.EMAIL_TAKEN);
					assertThat(e.getMessage()).isEqualTo("Já existe uma conta com este e-mail.");
				});
	}
}
