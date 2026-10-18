package com.dinomutation.player;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class PlayerApiTest extends IntegrationTest {

	private static final String BROWSER_SAVE = """
			{"save":{"runs":34,"wins":9,"bestTime":1210.5,"bestByDino":{"trex":1210.5,"raptor":300},
			"lastDino":"trex","fossils":820,"mastery":{"trex":640,"raptor":120},
			"shop":{"trex":{"meta_vida":3,"meta_trex_crit":1}},"endlessRuns":2,"bestEra":3,
			"bestEraByDino":{"trex":3},"seenPatch":"0.2.0","cleared":{"trex":1},"difficulty":{"trex":"predador"}}}
			""";

	private String token;

	@BeforeEach
	void signUp() throws Exception {
		token = newPlayerToken("pedro@example.com");
	}

	private ResultActions getSave() throws Exception {
		return mvc.perform(get("/api/players/me/save").header("Authorization", bearer(token)));
	}

	private ResultActions importSave(String body) throws Exception {
		return mvc.perform(post("/api/players/me/import").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(body));
	}

	private ResultActions preferences(String body) throws Exception {
		return mvc.perform(patch("/api/players/me/preferences").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(body));
	}

	@Test
	void newAccountHasAnEmptySave() throws Exception {
		getSave().andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value("pedro@example.com"))
				.andExpect(jsonPath("$.displayName").value("Jogador"))
				.andExpect(jsonPath("$.fossils").value(0))
				.andExpect(jsonPath("$.runs").value(0))
				.andExpect(jsonPath("$.mastery").isEmpty())
				.andExpect(jsonPath("$.lastDino").doesNotExist());
	}

	@Test
	void preferencesKeepSeenPatchAndAnUnlockedDifficulty() throws Exception {
		preferences("""
				{"seenPatch":"0.2.0","difficulty":{"dino":"trex","id":"filhote"}}
				""").andExpect(status().isNoContent());
		getSave().andExpect(jsonPath("$.seenPatch").value("0.2.0"))
				.andExpect(jsonPath("$.difficulty.trex").value("filhote"));
	}

	@Test
	void lockedDifficultyIs409() throws Exception {
		preferences("""
				{"difficulty":{"dino":"trex","id":"normal"}}
				""").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DIFFICULTY_LOCKED"));
	}

	@Test
	void unknownDinoIs400() throws Exception {
		preferences("""
				{"difficulty":{"dino":"stego","id":"filhote"}}
				""").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void importCopiesTheBrowserSave() throws Exception {
		importSave(BROWSER_SAVE).andExpect(status().isOk()).andExpect(jsonPath("$.fossils").value(820));
		getSave().andExpect(jsonPath("$.runs").value(34))
				.andExpect(jsonPath("$.wins").value(9))
				.andExpect(jsonPath("$.mastery.trex").value(640))
				.andExpect(jsonPath("$.shop.trex.meta_vida").value(3))
				.andExpect(jsonPath("$.cleared.trex").value(1))
				.andExpect(jsonPath("$.difficulty.trex").value("predador"))
				.andExpect(jsonPath("$.bestEraByDino.trex").value(3));
	}

	@Test
	void secondImportIs409() throws Exception {
		importSave(BROWSER_SAVE).andExpect(status().isOk());
		importSave(BROWSER_SAVE).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ALREADY_IMPORTED"));
	}

	@Test
	void importWithImpossibleValuesIs400AndChangesNothing() throws Exception {
		importSave("""
				{"save":{"runs":1,"wins":0,"fossils":50,"shop":{"trex":{"meta_vida":9}}}}
				""").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		importSave("""
				{"save":{"runs":1,"wins":0,"fossils":50,"mastery":{"stego":10}}}
				""").andExpect(status().isBadRequest());
		importSave("""
				{"save":{"runs":1,"wins":0,"fossils":-5}}
				""").andExpect(status().isBadRequest());
		getSave().andExpect(jsonPath("$.fossils").value(0)).andExpect(jsonPath("$.runs").value(0));
	}

}
