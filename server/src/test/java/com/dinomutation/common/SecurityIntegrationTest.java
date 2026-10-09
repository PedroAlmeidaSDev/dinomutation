package com.dinomutation.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import com.dinomutation.auth.AccessTokenService;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class SecurityIntegrationTest extends IntegrationTest {

	@Autowired
	AccessTokenService tokens;

	@Autowired
	JwtDecoder decoder;

	@Test
	void protectedRouteWithoutTokenIs401() throws Exception {
		mvc.perform(get("/api/players/me/save")).andExpect(status().isUnauthorized());
	}

	@Test
	void garbageTokenIs401() throws Exception {
		mvc.perform(get("/api/players/me/save").header("Authorization", "Bearer nope")).andExpect(status().isUnauthorized());
	}

	@Test
	void validTokenPassesTheFilter() throws Exception {
		String token = tokens.issue(UUID.randomUUID(), "a@example.com").value();
		// Authenticated, but no controller there yet: 404 instead of 401.
		mvc.perform(get("/api/does-not-exist").header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
	}

	@Test
	void issuedTokenCarriesPlayerIssuerAndFifteenMinutes() {
		UUID id = UUID.randomUUID();
		Jwt jwt = decoder.decode(tokens.issue(id, "a@example.com").value());
		assertThat(jwt.getSubject()).isEqualTo(id.toString());
		assertThat(jwt.getClaimAsString("iss")).isEqualTo("dinomutation");
		assertThat(jwt.getClaimAsString("email")).isEqualTo("a@example.com");
		assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofMinutes(15));
	}

	@Test
	void healthAndApiDocsArePublic() throws Exception {
		mvc.perform(get("/actuator/health")).andExpect(status().isOk());
		mvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
	}

}
