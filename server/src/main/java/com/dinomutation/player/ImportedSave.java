package com.dinomutation.player;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** The game's SaveData as read from localStorage (maps keyed by dino id, checked by SaveImporter). */
public record ImportedSave(
		@PositiveOrZero int runs,
		@PositiveOrZero int wins,
		@PositiveOrZero double bestTime,
		Map<String, Double> bestByDino,
		String lastDino,
		@PositiveOrZero int fossils,
		Map<String, Integer> mastery,
		Map<String, Map<String, Integer>> shop,
		@PositiveOrZero int endlessRuns,
		@PositiveOrZero int bestEra,
		Map<String, Integer> bestEraByDino,
		@Size(max = 20) String seenPatch,
		Map<String, Integer> cleared,
		Map<String, String> difficulty) {}
