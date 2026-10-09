package com.dinomutation.run;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A recorded run with what the server paid for it (kept so a resend returns the same rewards). */
@Entity
@Table(name = "run")
public class GameRun {

	@Id
	private UUID id;

	@Column(nullable = false)
	private UUID playerId;

	private String dino;
	private String difficulty;
	private boolean victory;
	private boolean eliteKilled;
	private boolean bossKilled;
	private boolean endless;
	private double elapsedTime;
	private double endlessTime;
	private int kills;
	private int level;
	private int era;
	private double damageDealt;
	private double damageTaken;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false)
	private List<UpgradeEntry> upgrades;

	private int fossilsEarned;
	private int firstWinBonus;
	private String unlockedDifficulty;
	private int masteryXpEarned;
	private int masteryLevelBefore;
	private int masteryLevelAfter;

	@Column(nullable = false)
	private Instant createdAt;

	protected GameRun() {
	}

	public static GameRun of(UUID playerId, RunRequest req, RunRewardsDto rewards, Instant now) {
		GameRun r = new GameRun();
		r.id = req.id();
		r.playerId = playerId;
		r.dino = req.dino().id();
		r.difficulty = req.difficulty().id();
		r.victory = req.victory();
		r.eliteKilled = req.eliteKilled();
		r.bossKilled = req.bossKilled();
		r.endless = req.endless();
		r.elapsedTime = req.elapsedTime();
		r.endlessTime = req.endlessTime();
		r.kills = req.kills();
		r.level = req.level();
		r.era = req.era();
		r.damageDealt = req.damageDealt();
		r.damageTaken = req.damageTaken();
		r.upgrades = List.copyOf(req.upgrades());
		r.fossilsEarned = rewards.fossils();
		r.firstWinBonus = rewards.firstWinBonus();
		r.unlockedDifficulty = rewards.unlockedDifficulty();
		r.masteryXpEarned = rewards.masteryXp();
		r.masteryLevelBefore = rewards.levelBefore();
		r.masteryLevelAfter = rewards.levelAfter();
		r.createdAt = now;
		return r;
	}

	public UUID getPlayerId() {
		return playerId;
	}

	public RunRewardsDto rewards() {
		return new RunRewardsDto(fossilsEarned, firstWinBonus, unlockedDifficulty, masteryXpEarned, masteryLevelBefore,
				masteryLevelAfter);
	}
}
