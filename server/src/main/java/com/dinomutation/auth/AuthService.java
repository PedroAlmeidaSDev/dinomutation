package com.dinomutation.auth;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.player.Player;
import com.dinomutation.player.PlayerRepository;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;
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
	private final GoogleTokenVerifier google;

	public AuthService(PlayerRepository players, PasswordEncoder passwords, AccessTokenService accessTokens,
			RefreshTokenService refreshTokens, Clock clock, GoogleTokenVerifier google) {
		this.players = players;
		this.passwords = passwords;
		this.accessTokens = accessTokens;
		this.refreshTokens = refreshTokens;
		this.clock = clock;
		this.google = google;
	}

	@Transactional
	public Session register(RegisterRequest req) {
		String email = normalizeEmail(req.email());
		if (req.password().getBytes(StandardCharsets.UTF_8).length > 72) {
			throw new ApiException(ErrorCode.VALIDATION_ERROR, "A senha pode ter no máximo 72 bytes.");
		}
		String displayName = req.displayName().trim();
		if (displayName.length() < 2 || displayName.length() > 40) {
			throw new ApiException(ErrorCode.VALIDATION_ERROR, "O nome deve ter de 2 a 40 caracteres.");
		}
		if (players.existsByEmail(email)) {
			throw new ApiException(ErrorCode.EMAIL_TAKEN, "Já existe uma conta com este e-mail.");
		}
		Player player = Player.create(email, displayName, clock.instant());
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

	/** Same noRollbackFor as consume(): this transaction wraps it and must keep the reuse revocation. */
	@Transactional(noRollbackFor = ApiException.class)
	public Session refresh(String refreshToken) {
		UUID playerId = refreshTokens.consume(refreshToken);
		return startSession(players.getRequired(playerId));
	}

	public void logout(String refreshToken) {
		refreshTokens.revoke(refreshToken);
	}

	@Transactional
	public Session google(GoogleLoginRequest req) {
		GoogleIdentity identity = google.verify(req.idToken());
		String email = normalizeEmail(identity.email());
		Player player = players.findByGoogleSub(identity.subject()).orElseGet(() -> linkOrCreate(identity, email));
		return startSession(player);
	}

	/**
	 * Same e-mail as an existing account. Google proves the e-mail belongs to this person;
	 * our sign-up doesn't (no e-mail confirmation), so a password on that account may have
	 * been set by someone else (account pre-hijacking). Link the account, drop its password
	 * and end its sessions.
	 */
	private Player linkOrCreate(GoogleIdentity identity, String email) {
		return players.findByEmail(email).map(existing -> {
			if (existing.getGoogleSub() != null) {
				throw new ApiException(ErrorCode.CONFLICT, "Este e-mail já está ligado a outra conta Google.");
			}
			existing.setGoogleSub(identity.subject());
			if (existing.getPasswordHash() != null) {
				existing.setPasswordHash(null);
				refreshTokens.revokeAll(existing.getId());
			}
			return existing;
		}).orElseGet(() -> {
			Player created = Player.create(email, displayNameFor(identity, email), clock.instant());
			created.setGoogleSub(identity.subject());
			return players.save(created);
		});
	}

	private static String displayNameFor(GoogleIdentity identity, String email) {
		String name = identity.name() == null ? "" : identity.name().trim();
		if (name.length() < 2) {
			name = email.substring(0, email.indexOf('@'));
		}
		if (name.length() < 2) {
			name = "Jogador";
		}
		return name.length() > 40 ? name.substring(0, 40) : name;
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
