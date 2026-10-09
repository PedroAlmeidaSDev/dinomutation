package com.dinomutation.run;

import com.dinomutation.player.FirstClear;
import com.fasterxml.jackson.annotation.JsonInclude;

/** First-win result: bonus paid (0 if that difficulty was already beaten) and the id it unlocked. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ClearResponse(int firstWinBonus, String unlockedDifficulty) {

	public static ClearResponse of(FirstClear clear) {
		return new ClearResponse(clear.firstWinBonus(), clear.unlockedDifficulty());
	}
}
