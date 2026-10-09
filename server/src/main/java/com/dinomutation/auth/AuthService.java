package com.dinomutation.auth;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.player.Player;
import com.dinomutation.player.PlayerRepository;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

	private final PlayerRepository players;
	private final PasswordEncoder passwords;
	private final AccessTokenService accessTokens;
	private final RefreshTokenService refreshTokens;
	private final Clock clock;

	public AuthService(PlayerRepository players, PasswordEncoder passwords, AccessTokenService accessTokens,
			RefreshTokenService refreshTokens, Clock clock) {
		this.players = players;
		this.passwords = passwords;
		this.accessTokens = accessTokens;
		this.refreshTokens = refreshTokens;
		this.clock = clock;
	}

	@Transactional
	public Session register(RegisterRequest req) {
		String email = normalizeEmail(req.email());
		if (req.password().getBytes(StandardCharsets.UTF_8).length > 72) {
			throw new ApiException(ErrorCode.VALIDATION_ERROR, "A senha pode ter no máximo 72 bytes.");
		}
		if (players.existsByEmail(email)) {
			throw new ApiException(ErrorCode.EMAIL_TAKEN, "Já existe uma conta com este e-mail.");
		}
		Player player = Player.create(email, req.displayName().trim(), clock.instant());
		player.setPasswordHash(passwords.encode(req.password()));
		return startSession(players.save(player));
	}

	@Transactional
	public Session login(LoginRequest req) {
		Player player = players.findByEmail(normalizeEmail(req.email()))
				.filter(p -> p.getPasswordHash() != null && passwords.matches(req.password(), p.getPasswordHash()))
				.orElseThrow(AuthService::invalidCredentials);
		return startSession(player);
	}

	Session startSession(Player player) {
		return new Session(accessTokens.issue(player.getId(), player.getEmail()), refreshTokens.create(player.getId()));
	}

	public static String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}

	static ApiException invalidCredentials() {
		return new ApiException(ErrorCode.INVALID_CREDENTIALS, "E-mail ou senha inválidos.");
	}
}
