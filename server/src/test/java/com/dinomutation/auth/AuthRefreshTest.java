package com.dinomutation.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

class AuthRefreshTest extends IntegrationTest {

	private MvcResult refresh(Cookie cookie) throws Exception {
		return mvc.perform(post("/api/auth/refresh").cookie(cookie)).andReturn();
	}

	@Test
	void refreshRotatesTheCookie() throws Exception {
		Cookie first = refreshCookie(register("pedro@example.com", PASSWORD, "Pedro"));

		MvcResult result = refresh(first);
		assertThat(result.getResponse().getStatus()).isEqualTo(200);
		assertThat(accessToken(result)).isNotBlank();
		Cookie second = refreshCookie(result);
		assertThat(second.getValue()).isNotEqualTo(first.getValue());

		assertThat(refresh(second).getResponse().getStatus()).isEqualTo(200);
	}

	@Test
	void reusingARotatedCookieEndsEverySession() throws Exception {
		Cookie first = refreshCookie(register("pedro@example.com", PASSWORD, "Pedro"));
		Cookie second = refreshCookie(refresh(first));

		// Someone replays the old cookie: it is refused and the current one dies too.
		assertThat(refresh(first).getResponse().getStatus()).isEqualTo(401);
		assertThat(refresh(second).getResponse().getStatus()).isEqualTo(401);
	}

	@Test
	void missingOrUnknownCookieIs401() throws Exception {
		mvc.perform(post("/api/auth/refresh")).andExpect(status().isUnauthorized());
		assertThat(refresh(new Cookie("refresh_token", "inventado")).getResponse().getStatus()).isEqualTo(401);
	}

	@Test
	void expiredCookieIs401() throws Exception {
		Cookie cookie = refreshCookie(register("pedro@example.com", PASSWORD, "Pedro"));
		jdbc.update("update refresh_token set expires_at = now() - interval '1 minute'");
		assertThat(refresh(cookie).getResponse().getStatus()).isEqualTo(401);
	}

	@Test
	void logoutRevokesAndClearsTheCookie() throws Exception {
		Cookie cookie = refreshCookie(register("pedro@example.com", PASSWORD, "Pedro"));

		MvcResult result = mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent()).andReturn();
		assertThat(setCookieHeader(result)).contains("Max-Age=0");

		assertThat(refresh(cookie).getResponse().getStatus()).isEqualTo(401);
	}

}
