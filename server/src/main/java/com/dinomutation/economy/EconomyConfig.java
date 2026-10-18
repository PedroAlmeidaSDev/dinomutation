package com.dinomutation.economy;

import java.util.List;
import java.util.Map;

/** Shape of shared/economy.json. */
public record EconomyConfig(
		List<String> dinos,
		Fossils fossils,
		Mastery mastery,
		List<Difficulty> difficulties,
		Map<String, List<ShopItem>> shop) {

	public record Fossils(int perMinute, int perKills, int elite, int boss) {}

	public record Mastery(int secondsPerXp, int elite, int boss, int maxLevel, int xpPerLevel) {}

	public record Difficulty(String id, double fossilMult, int firstWinBonus) {}

	public record ShopItem(String id, List<Integer> costs) {}
}
