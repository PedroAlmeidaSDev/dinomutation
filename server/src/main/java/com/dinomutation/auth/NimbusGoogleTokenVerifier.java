package com.dinomutation.auth;

import com.dinomutation.common.AppProperties;
import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import java.util.Collection;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Verifies Google ID tokens against Google's public keys: signature, expiry, issuer,
 * audience (our client id) and a verified e-mail. Not a JwtDecoder bean on purpose:
 * the resource server must keep using our own decoder (JwtConfig).
 */
@Component
public class NimbusGoogleTokenVerifier implements GoogleTokenVerifier {

	private static final Logger log = LoggerFactory.getLogger(NimbusGoogleTokenVerifier.class);
	private static final String JWKS = "https://www.googleapis.com/oauth2/v3/certs";
	private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

	private final String clientId;
	private final NimbusJwtDecoder decoder;

	public NimbusGoogleTokenVerifier(AppProperties props) {
		this.clientId = props.google().clientId();
		this.decoder = NimbusJwtDecoder.withJwkSetUri(JWKS).build();
		this.decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
				new JwtTimestampValidator(),
				new JwtClaimValidator<Object>(JwtClaimNames.ISS, iss -> iss != null && ISSUERS.contains(iss.toString())),
				new JwtClaimValidator<Object>(JwtClaimNames.AUD,
						aud -> aud instanceof Collection<?> list ? list.contains(clientId) : clientId != null && clientId.equals(aud))));
	}

	@Override
	public GoogleIdentity verify(String idToken) {
		if (clientId == null || clientId.isBlank()) {
			log.warn("GOOGLE_CLIENT_ID não configurado: login com Google recusado");
			throw invalid();
		}
		Jwt jwt;
		try {
			jwt = decoder.decode(idToken);
		} catch (JwtException e) {
			throw invalid();
		}
		Object verified = jwt.getClaims().get("email_verified");
		String email = jwt.getClaimAsString("email");
		if (email == null || !(Boolean.TRUE.equals(verified) || "true".equals(verified))) {
			throw invalid();
		}
		return new GoogleIdentity(jwt.getSubject(), email, jwt.getClaimAsString("name"));
	}

	private static ApiException invalid() {
		return new ApiException(ErrorCode.INVALID_CREDENTIALS, "Não foi possível confirmar o login com o Google.");
	}
}
