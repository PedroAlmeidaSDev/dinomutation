package com.dinomutation.auth;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.AppProperties;
import com.dinomutation.common.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RefreshTokenService {

	private static final SecureRandom RANDOM = new SecureRandom();

	private final RefreshTokenRepository tokens;
	private final Clock clock;
	private final Duration ttl;

	public RefreshTokenService(RefreshTokenRepository tokens, Clock clock, AppProperties props) {
		this.tokens = tokens;
		this.clock = clock;
		this.ttl = props.jwt().refreshTtl();
	}

	/** Issues a new refresh token for the player and returns the raw value (only its hash is stored). */
	@Transactional
	public String create(UUID playerId) {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		String value = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		tokens.save(new RefreshToken(playerId, hash(value), clock.instant(), ttl));
		return value;
	}

	/**
	 * Validates and spends a refresh token, returning its player. A token that was already
	 * rotated means someone copied it: every session of that player is revoked. The revocation
	 * must survive the 401, hence noRollbackFor (callers in a transaction need it too).
	 */
	@Transactional(noRollbackFor = ApiException.class)
	public UUID consume(String value) {
		if (value == null || value.isBlank()) {
			throw invalid();
		}
		RefreshToken token = tokens.findByTokenHash(hash(value)).orElseThrow(RefreshTokenService::invalid);
		Instant now = clock.instant();
		if (token.isRevoked()) {
			tokens.revokeAllForPlayer(token.getPlayerId(), now);
			throw invalid();
		}
		if (token.isExpired(now)) {
			throw invalid();
		}
		// Atomic spend: if a concurrent request got there first, this is a reuse too.
		if (tokens.markRevokedIfActive(token.getId(), now) == 0) {
			tokens.revokeAllForPlayer(token.getPlayerId(), now);
			throw invalid();
		}
		return token.getPlayerId();
	}

	@Transactional
	public void revoke(String value) {
		if (value == null || value.isBlank()) {
			return;
		}
		tokens.findByTokenHash(hash(value)).filter(t -> !t.isRevoked()).ifPresent(t -> t.revoke(clock.instant()));
	}

	@Transactional
	public void revokeAll(UUID playerId) {
		tokens.revokeAllForPlayer(playerId, clock.instant());
	}

	private static ApiException invalid() {
		return new ApiException(ErrorCode.INVALID_CREDENTIALS, "Sessão expirada; entre de novo.");
	}

	static String hash(String value) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
