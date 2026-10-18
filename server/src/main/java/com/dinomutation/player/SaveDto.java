package com.dinomutation.player;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;
import java.util.TreeMap;

/**
 * The account's save in the exact shape of the game's SaveData (client/src/game/core/Save.ts),
 * plus e-mail and display name. Maps only list dinosaurs that have that kind of progress,
 * like the game's Partial<Record<…>>.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SaveDto(
		String email,
		String displayName,
		int runs,
		int wins,
		double bestTime,
		Map<String, Double> bestByDino,
		String lastDino,
		int fossils,
		Map<String, Integer> mastery,
		Map<String, Map<String, Integer>> shop,
		int endlessRuns,
		int bestEra,
		Map<String, Integer> bestEraByDino,
		String seenPatch,
		Map<String, Integer> cleared,
		Map<String, String> difficulty) {

	public static SaveDto of(Player p) {
		Map<String, Double> bestByDino = new TreeMap<>();
		Map<String, Integer> mastery = new TreeMap<>();
		Map<String, Integer> bestEraByDino = new TreeMap<>();
		Map<String, Integer> cleared = new TreeMap<>();
		Map<String, String> difficulty = new TreeMap<>();
		p.getDinos().forEach((dino, d) -> {
			bestByDino.put(dino, d.getBestTime());
			mastery.put(dino, d.getMasteryXp());
			if (d.getBestEra() > 0) {
				bestEraByDino.put(dino, d.getBestEra());
			}
			if (d.getClearedIndex() >= 0) {
				cleared.put(dino, d.getClearedIndex());
			}
			if (d.getPreferredDifficulty() != null) {
				difficulty.put(dino, d.getPreferredDifficulty());
			}
		});
		Map<String, Map<String, Integer>> shop = new TreeMap<>();
		p.getShop().forEach((key, level) -> shop.computeIfAbsent(key.dino(), k -> new TreeMap<>()).put(key.itemId(), level));
		return new SaveDto(p.getEmail(), p.getDisplayName(), p.getRuns(), p.getWins(), p.getBestTime(), bestByDino,
				p.getLastDino(), p.getFossils(), mastery, shop, p.getEndlessRuns(), p.getBestEra(), bestEraByDino,
				p.getSeenPatch(), cleared, difficulty);
	}
}
