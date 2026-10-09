package com.dinomutation.auth;

import com.dinomutation.common.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
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

	static String hash(String value) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
