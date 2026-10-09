package com.dinomutation.leaderboard;

import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeaderboardService {

	private final LeaderboardRepository repository;

	public LeaderboardService(LeaderboardRepository repository) {
		this.repository = repository;
	}

	/** `playerId` is null for guests; then the response has no `me`. */
	@Transactional(readOnly = true)
	public LeaderboardResponse leaderboard(DinoId dino, DifficultyId difficulty, int limit, UUID playerId) {
		String dinoId = dino == null ? null : dino.id();
		String difficultyId = difficulty == null ? null : difficulty.id();
		LeaderboardEntry me = playerId == null ? null : repository.placeOf(playerId, dinoId, difficultyId).orElse(null);
		return new LeaderboardResponse(repository.top(dinoId, difficultyId, limit), me);
	}
}
