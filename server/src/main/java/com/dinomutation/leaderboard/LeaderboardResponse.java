package com.dinomutation.leaderboard;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** `me` is the signed-in player's own line (omitted for guests or without a run in the filter). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LeaderboardResponse(List<LeaderboardEntry> entries, LeaderboardEntry me) {}
