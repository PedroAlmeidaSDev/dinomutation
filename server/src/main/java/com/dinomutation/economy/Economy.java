package com.dinomutation.economy;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Pure economy rules, mirroring client/src/data/meta.ts and difficulty.ts operation by
 * operation (same order of float operations, same floors), so both sides pay the same.
 * The numbers come from shared/economy.json, copied to the classpath by Maven.
 */
public final class Economy {

	private final EconomyConfig config;

	public Economy(EconomyConfig config) {
		this.config = config;
		requireSameIds("dinos", Arrays.stream(DinoId.values()).map(DinoId::id).toList(), config.dinos());
		requireSameIds("dificuldades", Arrays.stream(DifficultyId.values()).map(DifficultyId::id).toList(),
				config.difficulties().stream().map(EconomyConfig.Difficulty::id).toList());
		for (DinoId dino : DinoId.values()) {
			if (!config.shop().containsKey(dino.id())) {
				throw new IllegalStateException("economy.json: sem loja para " + dino.id());
			}
		}
	}

	public static Economy loadDefault() {
		try (InputStream in = Economy.class.getResourceAsStream("/economy.json")) {
			if (in == null) {
				throw new IllegalStateException("economy.json não está no classpath");
			}
			return new Economy(JsonMapper.builder().build().readValue(in, EconomyConfig.class));
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	public int fossilsForRun(RunFacts r) {
		EconomyConfig.Fossils f = config.fossils();
		double base = (r.elapsedTime() / 60) * f.perMinute()
				+ Math.floor((double) r.kills() / f.perKills())
				+ (r.eliteKilled() ? f.elite() : 0)
				+ (r.bossKilled() ? f.boss() : 0);
		return (int) Math.floor(base * difficulty(r.difficulty()).fossilMult());
	}

	public int masteryXpForRun(RunFacts r) {
		EconomyConfig.Mastery m = config.mastery();
		return (int) Math.floor(r.elapsedTime() / m.secondsPerXp())
				+ (r.eliteKilled() ? m.elite() : 0)
				+ (r.bossKilled() ? m.boss() : 0);
	}

	/** Mastery level (1..max) for a total amount of mastery XP. */
	public int masteryLevel(int xp) {
		EconomyConfig.Mastery m = config.mastery();
		int level = 1;
		int need = m.xpPerLevel();
		int left = xp;
		while (level < m.maxLevel() && left >= need) {
			left -= need;
			level++;
			need = m.xpPerLevel() * level;
		}
		return level;
	}

	public EconomyConfig.Difficulty difficulty(DifficultyId id) {
		return config.difficulties().get(id.ordinal());
	}

	public int difficultyIndex(DifficultyId id) {
		return id.ordinal();
	}

	public int lastDifficultyIndex() {
		return config.difficulties().size() - 1;
	}

	/** `cleared` = index of the highest difficulty beaten (-1 = none). */
	public int highestUnlocked(int cleared) {
		return Math.min(lastDifficultyIndex(), cleared + 1);
	}

	public boolean isUnlocked(DifficultyId id, int cleared) {
		return difficultyIndex(id) <= highestUnlocked(cleared);
	}

	public Optional<DifficultyId> next(DifficultyId id) {
		DifficultyId[] all = DifficultyId.values();
		return id.ordinal() + 1 < all.length ? Optional.of(all[id.ordinal() + 1]) : Optional.empty();
	}

	public Optional<EconomyConfig.ShopItem> shopItem(DinoId dino, String itemId) {
		return config.shop().get(dino.id()).stream().filter(i -> i.id().equals(itemId)).findFirst();
	}

	private static void requireSameIds(String what, List<String> java, List<String> json) {
		if (!java.equals(json)) {
			throw new IllegalStateException("economy.json: " + what + " diverge do Java (Java: " + java + " · JSON: " + json + ")");
		}
	}
}
