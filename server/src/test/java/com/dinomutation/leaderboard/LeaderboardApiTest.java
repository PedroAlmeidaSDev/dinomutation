package com.dinomutation.leaderboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

class LeaderboardApiTest extends IntegrationTest {

	record Account(UUID id, String token) {}

	private Account account(String name) throws Exception {
		String email = name.toLowerCase() + "@example.com";
		MvcResult result = register(email, PASSWORD, name);
		assertThat(result.getResponse().getStatus()).isEqualTo(201);
		UUID id = jdbc.queryForObject("select id from player where email = ?", UUID.class, email);
		return new Account(id, accessToken(result));
	}

	/** Inserts a finished run directly: the ranking only reads the table, so setup skips the economy rules. */
	private void run(Account who, String dino, String difficulty, double elapsed, int era, String createdAt) {
		boolean endless = era > 0;
		jdbc.update("""
				insert into run (id, player_id, dino, difficulty, victory, elite_killed, boss_killed, endless, elapsed_time,
				  endless_time, kills, level, era, damage_dealt, damage_taken, upgrades, fossils_earned, first_win_bonus,
				  mastery_xp_earned, mastery_level_before, mastery_level_after, created_at)
				values (?, ?, ?, ?, ?, false, ?, ?, ?, 0, 0, 1, ?, 0, 0, '[]'::jsonb, 0, 0, 0, 1, 1, ?::timestamptz)
				""", UUID.randomUUID(), who.id(), dino, difficulty, endless, endless, endless, elapsed, era, createdAt);
	}

	@Test
	void ranksByLongestTimeWithOneLinePerPlayer() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		Account caio = account("Caio");
		run(ana, "trex", "filhote", 900, 0, "2026-10-01T10:00:00Z");
		run(ana, "raptor", "filhote", 1500.5, 3, "2026-10-02T10:00:00Z");
		run(bia, "triceratops", "filhote", 1200, 0, "2026-10-01T11:00:00Z");
		run(caio, "trex", "filhote", 300, 0, "2026-10-01T12:00:00Z");

		mvc.perform(get("/api/leaderboard")).andExpect(status().isOk())
				.andExpect(jsonPath("$.entries.length()").value(3))
				.andExpect(jsonPath("$.entries[0].rank").value(1))
				.andExpect(jsonPath("$.entries[0].displayName").value("Ana"))
				.andExpect(jsonPath("$.entries[0].elapsedTime").value(1500.5))
				.andExpect(jsonPath("$.entries[0].dino").value("raptor"))
				.andExpect(jsonPath("$.entries[0].difficulty").value("filhote"))
				.andExpect(jsonPath("$.entries[0].era").value(3))
				.andExpect(jsonPath("$.entries[0].achievedAt").exists())
				.andExpect(jsonPath("$.entries[1].displayName").value("Bia"))
				.andExpect(jsonPath("$.entries[2].displayName").value("Caio"))
				.andExpect(jsonPath("$.entries[2].rank").value(3));
	}

	@Test
	void tieGoesToWhoGotThereFirst() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		run(ana, "trex", "filhote", 1000, 0, "2026-10-02T10:00:00Z");
		run(bia, "trex", "filhote", 1000, 0, "2026-10-01T10:00:00Z");

		mvc.perform(get("/api/leaderboard"))
				.andExpect(jsonPath("$.entries[0].displayName").value("Bia"))
				.andExpect(jsonPath("$.entries[0].rank").value(1))
				.andExpect(jsonPath("$.entries[1].displayName").value("Ana"))
				.andExpect(jsonPath("$.entries[1].rank").value(2));
	}

	@Test
	void filtersByDinoAndDifficulty() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		run(ana, "trex", "normal", 1500, 0, "2026-10-01T10:00:00Z");
		run(ana, "raptor", "filhote", 600, 0, "2026-10-01T11:00:00Z");
		run(bia, "raptor", "filhote", 1200, 0, "2026-10-01T12:00:00Z");

		mvc.perform(get("/api/leaderboard").param("dino", "raptor"))
				.andExpect(jsonPath("$.entries.length()").value(2))
				.andExpect(jsonPath("$.entries[0].displayName").value("Bia"))
				.andExpect(jsonPath("$.entries[1].displayName").value("Ana"))
				.andExpect(jsonPath("$.entries[1].elapsedTime").value(600.0));
		mvc.perform(get("/api/leaderboard").param("difficulty", "normal"))
				.andExpect(jsonPath("$.entries.length()").value(1))
				.andExpect(jsonPath("$.entries[0].displayName").value("Ana"));
		mvc.perform(get("/api/leaderboard").param("dino", "raptor").param("difficulty", "normal"))
				.andExpect(jsonPath("$.entries").isEmpty());
	}

	@Test
	void signedInPlayerSeesTheirPlaceEvenOutsideTheLimit() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		Account caio = account("Caio");
		run(ana, "trex", "filhote", 3000, 0, "2026-10-01T10:00:00Z");
		run(bia, "trex", "filhote", 2000, 0, "2026-10-01T10:00:00Z");
		run(caio, "trex", "filhote", 1000, 0, "2026-10-01T10:00:00Z");

		mvc.perform(get("/api/leaderboard").param("limit", "2").header("Authorization", bearer(caio.token())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.entries.length()").value(2))
				.andExpect(jsonPath("$.me.rank").value(3))
				.andExpect(jsonPath("$.me.displayName").value("Caio"))
				.andExpect(jsonPath("$.me.elapsedTime").value(1000.0));
	}

	@Test
	void isPublicAndOmitsMeWithoutTokenOrRuns() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		run(ana, "trex", "filhote", 3000, 0, "2026-10-01T10:00:00Z");

		mvc.perform(get("/api/leaderboard")).andExpect(status().isOk()).andExpect(jsonPath("$.me").doesNotExist());
		mvc.perform(get("/api/leaderboard").header("Authorization", bearer(bia.token())))
				.andExpect(status().isOk()).andExpect(jsonPath("$.me").doesNotExist());
	}

	@Test
	void neverExposesEmails() throws Exception {
		Account ana = account("Ana");
		run(ana, "trex", "filhote", 3000, 0, "2026-10-01T10:00:00Z");

		String body = mvc.perform(get("/api/leaderboard").header("Authorization", bearer(ana.token())))
				.andReturn().getResponse().getContentAsString();
		assertThat(body).doesNotContain("@example.com").doesNotContain("email");
	}

	@Test
	void invalidParametersAre400() throws Exception {
		mvc.perform(get("/api/leaderboard").param("limit", "0"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mvc.perform(get("/api/leaderboard").param("limit", "51")).andExpect(status().isBadRequest());
		mvc.perform(get("/api/leaderboard").param("dino", "stego"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mvc.perform(get("/api/leaderboard").param("difficulty", "impossivel")).andExpect(status().isBadRequest());
	}

}
