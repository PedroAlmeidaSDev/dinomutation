package com.dinomutation.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class AuthGoogleTest extends IntegrationTest {

	private ResultActions google(String idToken) throws Exception {
		return mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(json("idToken", idToken)));
	}

	@Test
	void newGoogleUserGetsAnAccountWithoutPassword() throws Exception {
		google("valid:g-1:ana@example.com:Ana Souza").andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isNotEmpty());

		assertThat(jdbc.queryForObject("select google_sub from player", String.class)).isEqualTo("g-1");
		assertThat(jdbc.queryForObject("select display_name from player", String.class)).isEqualTo("Ana Souza");
		assertThat(jdbc.queryForObject("select password_hash from player", String.class)).isNull();
	}

	@Test
	void sameGoogleAccountSignsIntoTheSamePlayer() throws Exception {
		google("valid:g-1:ana@example.com:Ana").andExpect(status().isOk());
		google("valid:g-1:ana@example.com:Ana").andExpect(status().isOk());
		assertThat(jdbc.queryForObject("select count(*) from player", Integer.class)).isEqualTo(1);
	}

	@Test
	void googleWithTheEmailOfAPasswordAccountLinksAndDropsThePassword() throws Exception {
		Cookie oldSession = refreshCookie(register("ana@example.com", PASSWORD, "Ana"));

		google("valid:g-2:ANA@example.com:Ana").andExpect(status().isOk());

		assertThat(jdbc.queryForObject("select count(*) from player", Integer.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select google_sub from player", String.class)).isEqualTo("g-2");
		assertThat(jdbc.queryForObject("select password_hash from player", String.class)).isNull();
		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "ana@example.com", "password", PASSWORD)))
				.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/auth/refresh").cookie(oldSession)).andExpect(status().isUnauthorized());
	}

	@Test
	void emailAlreadyLinkedToAnotherGoogleAccountIs409() throws Exception {
		google("valid:g-1:ana@example.com:Ana").andExpect(status().isOk());
		google("valid:g-9:ana@example.com:Ana").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
	}

	@Test
	void blankGoogleNameFallsBackToTheEmail() throws Exception {
		google("valid:g-5:zeca@example.com: ").andExpect(status().isOk());
		assertThat(jdbc.queryForObject("select display_name from player", String.class)).isEqualTo("zeca");
	}

	@Test
	void invalidGoogleTokenIs401() throws Exception {
		google("forjado").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

}
