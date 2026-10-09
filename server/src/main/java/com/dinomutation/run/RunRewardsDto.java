package com.dinomutation.run;

import com.fasterxml.jackson.annotation.JsonInclude;

/** What a run paid. `unlockedDifficulty` is a difficulty id ("normal"); the game shows the name. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RunRewardsDto(int fossils, int firstWinBonus, String unlockedDifficulty, int masteryXp, int levelBefore,
		int levelAfter) {}
