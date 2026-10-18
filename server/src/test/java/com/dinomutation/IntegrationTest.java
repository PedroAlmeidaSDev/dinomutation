package com.dinomutation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.dinomutation.auth.FakeGoogleTokenVerifier;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Base for integration tests: the whole app against a real Postgres (Testcontainers).
 * Every subclass shares one Spring context (and one container), so keep the annotations here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import({ TestcontainersConfiguration.class, FakeGoogleTokenVerifier.Config.class })
public abstract class IntegrationTest {

	protected static final String PASSWORD = "senha-forte-123";

	@Autowired
	protected MockMvc mvc;

	@Autowired
	protected JdbcTemplate jdbc;

	@BeforeEach
	void cleanDatabase() {
		List<String> tables = jdbc.queryForList(
				"select tablename from pg_tables where schemaname = 'public' and tablename <> 'flyway_schema_history'",
				String.class);
		if (!tables.isEmpty()) {
			jdbc.execute("TRUNCATE " + String.join(", ", tables) + " CASCADE");
		}
	}

	protected MvcResult register(String email, String password, String displayName) throws Exception {
		return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", email, "password", password, "displayName", displayName))).andReturn();
	}

	/** Creates an account and returns its access token. */
	protected String newPlayerToken(String email) throws Exception {
		MvcResult result = register(email, PASSWORD, "Jogador");
		assertThat(result.getResponse().getStatus()).isEqualTo(201);
		return accessToken(result);
	}

	protected static String accessToken(MvcResult result) throws Exception {
		return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
	}

	protected static String setCookieHeader(MvcResult result) {
		return result.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
				.filter(h -> h.startsWith("refresh_token=")).findFirst().orElseThrow();
	}

	protected static Cookie refreshCookie(MvcResult result) {
		String header = setCookieHeader(result);
		return new Cookie("refresh_token", header.substring("refresh_token=".length(), header.indexOf(';')));
	}

	protected static String bearer(String token) {
		return "Bearer " + token;
	}

	/** Flat JSON object of string values: json("a", "1", "b", "2") → {"a":"1","b":"2"}. */
	protected static String json(String... keyValues) {
		StringBuilder sb = new StringBuilder("{");
		for (int i = 0; i < keyValues.length; i += 2) {
			if (i > 0) {
				sb.append(',');
			}
			sb.append('"').append(keyValues[i]).append("\":\"").append(keyValues[i + 1].replace("\"", "\\\"")).append('"');
		}
		return sb.append('}').toString();
	}

}
