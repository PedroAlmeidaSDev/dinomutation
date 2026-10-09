package com.dinomutation.player;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import com.dinomutation.economy.Economy;
import org.springframework.stereotype.Component;

/** Difficulty-ladder rules shared by preferences, clears and runs. */
@Component
public class ProgressRules {

	private final Economy economy;

	public ProgressRules(Economy economy) {
		this.economy = economy;
	}

	public void requireUnlocked(Player player, DinoId dino, DifficultyId difficulty) {
		if (!economy.isUnlocked(difficulty, player.clearedIndex(dino))) {
			throw new ApiException(ErrorCode.DIFFICULTY_LOCKED, "Esta dificuldade ainda não foi liberada para este dinossauro.");
		}
	}

	/** First win on a difficulty: unlocks the next one and pays the bonus once (applyClear in Save.ts). */
	public FirstClear applyClear(Player player, DinoId dino, DifficultyId difficulty) {
		DinoProgress progress = player.progress(dino);
		int index = economy.difficultyIndex(difficulty);
		if (index <= progress.getClearedIndex()) {
			return FirstClear.NONE;
		}
		progress.setClearedIndex(index);
		int bonus = economy.difficulty(difficulty).firstWinBonus();
		player.addFossils(bonus);
		return new FirstClear(bonus, economy.next(difficulty).map(DifficultyId::id).orElse(null));
	}
}
