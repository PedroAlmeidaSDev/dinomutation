package com.dinomutation.player;

/** Result of a first win on a difficulty: bonus paid and the difficulty id it unlocked (or none). */
public record FirstClear(int firstWinBonus, String unlockedDifficulty) {

	public static final FirstClear NONE = new FirstClear(0, null);
}
