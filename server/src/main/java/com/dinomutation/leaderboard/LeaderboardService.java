package com.dinomutation.leaderboard;

import com.dinomutation.common.AppProperties;
import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeaderboardService {

	private final LeaderboardRepository repository;
	private final Clock clock;
	private final Duration cacheTtl;
	private final Map<CacheKey, CacheEntry> cache = new ConcurrentHashMap<>();

	public LeaderboardService(LeaderboardRepository repository, Clock clock, AppProperties properties) {
		this.repository = repository;
		this.clock = clock;
		this.cacheTtl = properties.leaderboard().cacheTtl();
	}

	/** `playerId` is null for guests; then the response has no `me`. */
	@Transactional(readOnly = true)
	public LeaderboardResponse leaderboard(DinoId dino, DifficultyId difficulty, int limit, UUID playerId) {
		String dinoId = dino == null ? null : dino.id();
		String difficultyId = difficulty == null ? null : difficulty.id();
		LeaderboardEntry me = playerId == null ? null : repository.placeOf(playerId, dinoId, difficultyId).orElse(null);
		return new LeaderboardResponse(entries(dinoId, difficultyId, limit), me);
	}

	/**
	 * The ranking query scans the whole run table (no `player_best` table yet), so the `entries`
	 * list is cached in memory per (dino, difficulty, limit) for {@code app.leaderboard.cache-ttl}.
	 * `me` is never cached: it's one indexed row and always reflects the caller's latest run.
	 */
	private List<LeaderboardEntry> entries(String dino, String difficulty, int limit) {
		if (cacheTtl.isZero() || cacheTtl.isNegative()) {
			return repository.top(dino, difficulty, limit);
		}
		CacheKey key = new CacheKey(dino, difficulty, limit);
		Instant now = clock.instant();
		CacheEntry cached = cache.get(key);
		if (cached != null && now.isBefore(cached.expiresAt())) {
			return cached.entries();
		}
		List<LeaderboardEntry> fresh = repository.top(dino, difficulty, limit);
		cache.put(key, new CacheEntry(fresh, now.plus(cacheTtl)));
		return fresh;
	}

	private record CacheKey(String dino, String difficulty, int limit) {}

	private record CacheEntry(List<LeaderboardEntry> entries, Instant expiresAt) {}
}
