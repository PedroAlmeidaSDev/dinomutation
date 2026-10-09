package com.dinomutation.player;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import com.dinomutation.economy.Economy;
import com.dinomutation.economy.EconomyConfig;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Copies a browser save into an empty account. This is the one place the server trusts the
 * client (once per account), so every value is checked against what the game can produce.
 */
@Component
public class SaveImporter {

	/** The game keeps adding XP past the last level; this only rejects absurd values. */
	private static final int MAX_MASTERY_XP = 10_000_000;

	private final Economy economy;

	public SaveImporter(Economy economy) {
		this.economy = economy;
	}

	public void apply(Player p, ImportedSave s) {
		if (s.wins() > s.runs()) {
			throw invalid("mais vitórias do que runs");
		}
		p.setRuns(s.runs());
		p.setWins(s.wins());
		p.setBestTime(s.bestTime());
		p.addFossils(s.fossils());
		p.setEndlessRuns(s.endlessRuns());
		p.setBestEra(s.bestEra());
		p.setSeenPatch(s.seenPatch());
		p.setLastDino(s.lastDino() == null ? null : dino(s.lastDino()).id());

		orEmpty(s.bestByDino()).forEach((d, v) -> p.progress(dino(d)).setBestTime(nonNegative(v, "bestByDino")));
		orEmpty(s.bestEraByDino()).forEach((d, v) -> p.progress(dino(d)).setBestEra(nonNegative(v, "bestEraByDino")));
		orEmpty(s.mastery()).forEach((d, v) -> {
			int xp = nonNegative(v, "mastery");
			if (xp > MAX_MASTERY_XP) {
				throw invalid("maestria fora do limite");
			}
			p.progress(dino(d)).setMasteryXp(xp);
		});
		orEmpty(s.cleared()).forEach((d, v) -> {
			if (v == null || v < -1 || v > economy.lastDifficultyIndex()) {
				throw invalid("dificuldade vencida fora do intervalo");
			}
			p.progress(dino(d)).setClearedIndex(v);
		});
		// After `cleared`: the preferred difficulty must already be unlocked.
		orEmpty(s.difficulty()).forEach((d, v) -> {
			DinoId dino = dino(d);
			DifficultyId difficulty = difficulty(v);
			if (!economy.isUnlocked(difficulty, p.clearedIndex(dino))) {
				throw invalid("dificuldade preferida ainda bloqueada");
			}
			p.progress(dino).setPreferredDifficulty(difficulty.id());
		});
		orEmpty(s.shop()).forEach((d, items) -> {
			DinoId dino = dino(d);
			orEmpty(items).forEach((itemId, level) -> {
				EconomyConfig.ShopItem item = economy.shopItem(dino, itemId)
						.orElseThrow(() -> invalid("item desconhecido: " + itemId));
				if (level == null || level < 0 || level > item.costs().size()) {
					throw invalid("nível inválido para " + itemId);
				}
				if (level > 0) {
					p.setShopLevel(dino, itemId, level);
				}
			});
		});
	}

	private static DinoId dino(String id) {
		try {
			return DinoId.fromId(id);
		} catch (IllegalArgumentException e) {
			throw invalid("dinossauro desconhecido: " + id);
		}
	}

	private static DifficultyId difficulty(String id) {
		try {
			return DifficultyId.fromId(id);
		} catch (IllegalArgumentException e) {
			throw invalid("dificuldade desconhecida: " + id);
		}
	}

	private static int nonNegative(Integer v, String field) {
		if (v == null || v < 0) {
			throw invalid(field + " negativo");
		}
		return v;
	}

	private static double nonNegative(Double v, String field) {
		if (v == null || v < 0) {
			throw invalid(field + " negativo");
		}
		return v;
	}

	private static <K, V> Map<K, V> orEmpty(Map<K, V> map) {
		return map == null ? Map.of() : map;
	}

	private static ApiException invalid(String reason) {
		return new ApiException(ErrorCode.VALIDATION_ERROR, "Save inválido: " + reason + ".");
	}
}
