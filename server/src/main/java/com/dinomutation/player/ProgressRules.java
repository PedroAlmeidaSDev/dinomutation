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
}
