package com.dinomutation.auth;

import com.dinomutation.common.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class AccessTokenService {

	private final JwtEncoder encoder;
	private final Clock clock;
	private final Duration ttl;

	public AccessTokenService(JwtEncoder encoder, Clock clock, AppProperties props) {
		this.encoder = encoder;
		this.clock = clock;
		this.ttl = props.jwt().accessTtl();
	}

	public AccessToken issue(UUID playerId, String email) {
		Instant now = clock.instant();
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.issuer(JwtConfig.ISSUER)
				.subject(playerId.toString())
				.issuedAt(now)
				.expiresAt(now.plus(ttl))
				.claim("email", email)
				.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
		String value = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
		return new AccessToken(value, ttl.toSeconds());
	}
}
