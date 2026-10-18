package com.dinomutation.leaderboard;

import java.time.Instant;

/** One line of the ranking: a player's best run within the filter. Never carries the e-mail. */
public record LeaderboardEntry(int rank, String displayName, double elapsedTime, String dino, String difficulty, int era,
		Instant achievedAt) {}
