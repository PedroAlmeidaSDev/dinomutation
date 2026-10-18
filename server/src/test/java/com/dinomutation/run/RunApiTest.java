package com.dinomutation.run;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class RunApiTest extends IntegrationTest {

	private String token;

	@BeforeEach
	void signUp() throws Exception {
		token = newPlayerToken("pedro@example.com");
	}

	/** A run body; numbers match shared/economy-cases.json so the expected rewards are known. */
	private static String run(UUID id, String difficulty, boolean victory, double elapsed, int kills, boolean elite,
			boolean boss, boolean endless, int era, double endlessTime) {
		return String.format(Locale.ROOT, """
				{"id":"%s","dino":"trex","difficulty":"%s","victory":%b,"elapsedTime":%s,"kills":%d,"level":12,
				"eliteKilled":%b,"bossKilled":%b,"endless":%b,"era":%d,"endlessTime":%s,"damageDealt":12345.6,
				"damageTaken":987.5,"upgrades":[{"id":"bite_power","name":"Mordida Forte","rarity":"common","level":2}]}
				""", id, difficulty, victory, elapsed, kills, elite, boss, endless, era, endlessTime);
	}

	private static String defeat(UUID id) {
		return run(id, "filhote", false, 412.7, 361, true, false, false, 0, 0);
	}

	private static String filhoteWin(UUID id) {
		return run(id, "filhote", true, 900, 1240, true, true, false, 0, 0);
	}

	private ResultActions postRun(String body) throws Exception {
		return mvc.perform(post("/api/runs").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(body));
	}

	private ResultActions postClear(String dino, String difficulty) throws Exception {
		return mvc.perform(post("/api/clears").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(json("dino", dino, "difficulty", difficulty)));
	}

	@Test
	void defeatIsPaidByTheServerRules() throws Exception {
		postRun(defeat(UUID.randomUUID())).andExpect(status().isCreated())
				.andExpect(jsonPath("$.rewards.fossils").value(111))
				.andExpect(jsonPath("$.rewards.masteryXp").value(143))
				.andExpect(jsonPath("$.rewards.levelBefore").value(1))
				.andExpect(jsonPath("$.rewards.levelAfter").value(2))
				.andExpect(jsonPath("$.rewards.firstWinBonus").value(0))
				.andExpect(jsonPath("$.save.fossils").value(111))
				.andExpect(jsonPath("$.save.runs").value(1))
				.andExpect(jsonPath("$.save.wins").value(0))
				.andExpect(jsonPath("$.save.lastDino").value("trex"));
		assertThat(jdbc.queryForObject("select upgrades->0->>'id' from run", String.class)).isEqualTo("bite_power");
	}

	@Test
	void victoryAppliesTheFirstClearOnce() throws Exception {
		// 900 s, 1240 kills, elite + boss on Filhote: floor(405 × 0.75) = 303, plus the 60 first-win bonus.
		postRun(filhoteWin(UUID.randomUUID())).andExpect(status().isCreated())
				.andExpect(jsonPath("$.rewards.fossils").value(363))
				.andExpect(jsonPath("$.rewards.firstWinBonus").value(60))
				.andExpect(jsonPath("$.rewards.unlockedDifficulty").value("normal"))
				.andExpect(jsonPath("$.save.cleared.trex").value(0))
				.andExpect(jsonPath("$.save.wins").value(1));

		postRun(filhoteWin(UUID.randomUUID())).andExpect(status().isCreated())
				.andExpect(jsonPath("$.rewards.fossils").value(303))
				.andExpect(jsonPath("$.rewards.firstWinBonus").value(0))
				.andExpect(jsonPath("$.rewards.unlockedDifficulty").doesNotExist())
				.andExpect(jsonPath("$.save.fossils").value(666));
	}

	@Test
	void resendingTheSameRunIsIdempotent() throws Exception {
		UUID id = UUID.randomUUID();
		postRun(defeat(id)).andExpect(status().isCreated());
		postRun(defeat(id)).andExpect(status().isOk())
				.andExpect(jsonPath("$.rewards.fossils").value(111))
				.andExpect(jsonPath("$.save.fossils").value(111))
				.andExpect(jsonPath("$.save.runs").value(1));
		assertThat(jdbc.queryForObject("select count(*) from run", Integer.class)).isEqualTo(1);
	}

	@Test
	void clearWhenTheBossFallsPaysOnceAndTheRunDoesNotPayAgain() throws Exception {
		postClear("trex", "filhote").andExpect(status().isOk())
				.andExpect(jsonPath("$.firstWinBonus").value(60))
				.andExpect(jsonPath("$.unlockedDifficulty").value("normal"));
		postClear("trex", "filhote").andExpect(status().isOk()).andExpect(jsonPath("$.firstWinBonus").value(0));

		postRun(filhoteWin(UUID.randomUUID())).andExpect(status().isCreated())
				.andExpect(jsonPath("$.rewards.firstWinBonus").value(0))
				.andExpect(jsonPath("$.rewards.fossils").value(303))
				.andExpect(jsonPath("$.save.fossils").value(363));
	}

	@Test
	void endlessRunUpdatesBestEra() throws Exception {
		postRun(run(UUID.randomUUID(), "filhote", true, 1733.3, 3020, true, true, true, 4, 833.3))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.save.endlessRuns").value(1))
				.andExpect(jsonPath("$.save.bestEra").value(4))
				.andExpect(jsonPath("$.save.bestEraByDino.trex").value(4));
	}

	@Test
	void inconsistentRunsAre400() throws Exception {
		postRun(run(UUID.randomUUID(), "filhote", true, 900, 10, false, false, false, 0, 0))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		postRun(run(UUID.randomUUID(), "filhote", false, 900, 10, false, false, false, 3, 0))
				.andExpect(status().isBadRequest());
		postRun(run(UUID.randomUUID(), "filhote", false, 99999, 10, false, false, false, 0, 0))
				.andExpect(status().isBadRequest());
	}

	@Test
	void lockedDifficultyIs409() throws Exception {
		postRun(run(UUID.randomUUID(), "predador", false, 300, 100, false, false, false, 0, 0))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DIFFICULTY_LOCKED"));
		postClear("trex", "extincao").andExpect(status().isConflict());
	}

	@Test
	void aRunIdUsedByAnotherPlayerIs409() throws Exception {
		UUID id = UUID.randomUUID();
		postRun(defeat(id)).andExpect(status().isCreated());
		token = newPlayerToken("outra@example.com");
		postRun(defeat(id)).andExpect(status().isConflict());
	}

}
