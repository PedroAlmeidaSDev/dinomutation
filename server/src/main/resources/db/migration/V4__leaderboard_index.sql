-- Best run per player for the leaderboard (DISTINCT ON player_id ORDER BY elapsed_time DESC, created_at).
CREATE INDEX run_player_elapsed_idx ON run (player_id, elapsed_time DESC, created_at);
