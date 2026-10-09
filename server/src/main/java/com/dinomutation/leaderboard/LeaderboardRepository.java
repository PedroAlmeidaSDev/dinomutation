package com.dinomutation.leaderboard;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Ranking straight from the run table: DISTINCT ON keeps each player's best run (longest
 * time, earliest on ties) and RANK() numbers them. Native SQL, so plain JDBC instead of JPA.
 */
@Repository
public class LeaderboardRepository {

	private static final String RANKED = """
			WITH best AS (
			  SELECT DISTINCT ON (r.player_id)
			         r.player_id, r.elapsed_time, r.dino, r.difficulty, r.era, r.created_at
			  FROM run r
			  WHERE (CAST(:dino AS varchar) IS NULL OR r.dino = :dino)
			    AND (CAST(:difficulty AS varchar) IS NULL OR r.difficulty = :difficulty)
			  ORDER BY r.player_id, r.elapsed_time DESC, r.created_at ASC
			), ranked AS (
			  SELECT b.*, RANK() OVER (ORDER BY b.elapsed_time DESC, b.created_at ASC) AS place
			  FROM best b
			)
			SELECT ranked.place, p.display_name, ranked.elapsed_time, ranked.dino, ranked.difficulty, ranked.era, ranked.created_at
			FROM ranked JOIN player p ON p.id = ranked.player_id
			""";

	private final NamedParameterJdbcTemplate jdbc;

	public LeaderboardRepository(NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public List<LeaderboardEntry> top(String dino, String difficulty, int limit) {
		MapSqlParameterSource params = filter(dino, difficulty).addValue("limit", limit);
		return jdbc.query(RANKED + " ORDER BY ranked.place, p.display_name LIMIT :limit", params, LeaderboardRepository::entry);
	}

	public Optional<LeaderboardEntry> placeOf(UUID playerId, String dino, String difficulty) {
		MapSqlParameterSource params = filter(dino, difficulty).addValue("playerId", playerId);
		return jdbc.query(RANKED + " WHERE ranked.player_id = :playerId", params, LeaderboardRepository::entry).stream().findFirst();
	}

	/** Typed nulls: Postgres must know the parameter type even when the filter is absent. */
	private static MapSqlParameterSource filter(String dino, String difficulty) {
		return new MapSqlParameterSource()
				.addValue("dino", dino, Types.VARCHAR)
				.addValue("difficulty", difficulty, Types.VARCHAR);
	}

	private static LeaderboardEntry entry(ResultSet rs, int row) throws SQLException {
		return new LeaderboardEntry(rs.getInt("place"), rs.getString("display_name"), rs.getDouble("elapsed_time"),
				rs.getString("dino"), rs.getString("difficulty"), rs.getInt("era"),
				rs.getObject("created_at", OffsetDateTime.class).toInstant());
	}
}
