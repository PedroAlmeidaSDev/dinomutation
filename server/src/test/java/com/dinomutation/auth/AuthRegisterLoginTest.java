package com.dinomutation.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

class AuthRegisterLoginTest extends IntegrationTest {

	@Test
	void registerReturnsTokenAndHttpOnlyRefreshCookie() throws Exception {
		MvcResult result = register("Pedro@Example.com", PASSWORD, "Pedro");

		assertThat(result.getResponse().getStatus()).isEqualTo(201);
		assertThat(accessToken(result)).isNotBlank();
		assertThat(setCookieHeader(result)).contains("HttpOnly", "SameSite=Strict", "Path=/api/auth");
		assertThat(jdbc.queryForObject("select email from player", String.class)).isEqualTo("pedro@example.com");
		assertThat(jdbc.queryForObject("select password_hash from player", String.class)).startsWith("$2");
		assertThat(jdbc.queryForObject("select count(*) from refresh_token", Integer.class)).isEqualTo(1);
	}

	@Test
	void duplicateEmailIs409EmailTaken() throws Exception {
		register("pedro@example.com", PASSWORD, "Pedro");
		mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "PEDRO@example.com", "password", PASSWORD, "displayName", "Outro")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
	}

	@Test
	void invalidFieldsAre400WithOneErrorPerField() throws Exception {
		mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "not-an-email", "password", "short", "displayName", "P")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.errors.length()").value(3));
	}

	@Test
	void passwordOver72BytesIs400() throws Exception {
		// 40 characters (passes @Size) but 80 bytes in UTF-8: BCrypt only uses 72.
		mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "a@example.com", "password", "ç".repeat(40), "displayName", "Ana")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void displayNameIsValidatedAfterTrim() throws Exception {
		mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "a@example.com", "password", PASSWORD, "displayName", " a ")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void loginWithTheRightPasswordReturnsATokenAndCookie() throws Exception {
		register("pedro@example.com", PASSWORD, "Pedro");
		MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "Pedro@example.com", "password", PASSWORD)))
				.andExpect(status().isOk()).andReturn();
		assertThat(accessToken(result)).isNotBlank();
		assertThat(refreshCookie(result).getValue()).isNotBlank();
	}

	@Test
	void wrongPasswordAndUnknownEmailGiveTheSame401() throws Exception {
		register("pedro@example.com", PASSWORD, "Pedro");
		String wrongPassword = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "pedro@example.com", "password", "outra-senha-123")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
				.andReturn().getResponse().getContentAsString();
		String unknownEmail = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "ninguem@example.com", "password", PASSWORD)))
				.andExpect(status().isUnauthorized())
				.andReturn().getResponse().getContentAsString();
		assertThat(unknownEmail).isEqualTo(wrongPassword);
	}

}
