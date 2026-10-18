package com.dinomutation.run;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.Economy;
import com.dinomutation.economy.RunFacts;
import com.dinomutation.player.DinoProgress;
import com.dinomutation.player.FirstClear;
import com.dinomutation.player.Player;
import com.dinomutation.player.PlayerRepository;
import com.dinomutation.player.ProgressRules;
import com.dinomutation.player.SaveDto;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The server side of recordRun / recordClear (Save.ts): the client reports, the server pays. */
@Service
public class RunService {

	private final PlayerRepository players;
	private final GameRunRepository runs;
	private final Economy economy;
	private final ProgressRules rules;
	private final Clock clock;

	public RunService(PlayerRepository players, GameRunRepository runs, Economy economy, ProgressRules rules, Clock clock) {
		this.players = players;
		this.runs = runs;
		this.economy = economy;
		this.rules = rules;
		this.clock = clock;
	}

	/** Saved the moment the boss falls: the player may go endless and close the tab. */
	@Transactional
	public ClearResponse recordClear(UUID playerId, ClearRequest req) {
		Player player = players.getRequired(playerId);
		rules.requireUnlocked(player, req.dino(), req.difficulty());
		return ClearResponse.of(rules.applyClear(player, req.dino(), req.difficulty()));
	}

	@Transactional
	public RunOutcome recordRun(UUID playerId, RunRequest req) {
		Optional<GameRun> existing = runs.findById(req.id());
		if (existing.isPresent()) {
			if (!existing.get().getPlayerId().equals(playerId)) {
				throw new ApiException(ErrorCode.CONFLICT, "Este id de run já foi usado.");
			}
			return new RunOutcome(new RunResponse(existing.get().rewards(), SaveDto.of(players.getRequired(playerId))), false);
		}
		requireConsistent(req);
		Player player = players.getRequired(playerId);
		rules.requireUnlocked(player, req.dino(), req.difficulty());
		DinoProgress progress = player.progress(req.dino());

		player.setRuns(player.getRuns() + 1);
		if (req.victory()) {
			player.setWins(player.getWins() + 1);
		}
		player.setBestTime(Math.max(player.getBestTime(), req.elapsedTime()));
		progress.setBestTime(Math.max(progress.getBestTime(), req.elapsedTime()));
		player.setLastDino(req.dino().id());
		int era = req.endless() ? req.era() : 0;
		if (era > 0) {
			player.setEndlessRuns(player.getEndlessRuns() + 1);
			player.setBestEra(Math.max(player.getBestEra(), era));
			progress.setBestEra(Math.max(progress.getBestEra(), era));
		}

		RunFacts facts = new RunFacts(req.difficulty(), req.elapsedTime(), req.kills(), req.eliteKilled(), req.bossKilled());
		int runFossils = economy.fossilsForRun(facts);
		// Normally already applied by POST /api/clears when the boss fell; then this pays nothing.
		FirstClear clear = req.victory() ? rules.applyClear(player, req.dino(), req.difficulty()) : FirstClear.NONE;
		int masteryXp = economy.masteryXpForRun(facts);
		int levelBefore = economy.masteryLevel(progress.getMasteryXp());
		player.addFossils(runFossils);
		progress.setMasteryXp(progress.getMasteryXp() + masteryXp);
		int levelAfter = economy.masteryLevel(progress.getMasteryXp());

		RunRewardsDto rewards = new RunRewardsDto(runFossils + clear.firstWinBonus(), clear.firstWinBonus(),
				clear.unlockedDifficulty(), masteryXp, levelBefore, levelAfter);
		runs.save(GameRun.of(playerId, req, rewards, clock.instant()));
		return new RunOutcome(new RunResponse(rewards, SaveDto.of(player)), true);
	}

	/** Cheap consistency checks; statistical plausibility (kills per minute…) is phase 3. */
	private static void requireConsistent(RunRequest r) {
		if (r.victory() && !r.bossKilled()) {
			throw invalid("vitória sem o chefe derrotado");
		}
		if (r.endless() && !r.bossKilled()) {
			throw invalid("Era Sem Fim sem o chefe derrotado");
		}
		if (r.era() > 0 && !r.endless()) {
			throw invalid("Era fora do modo Sem Fim");
		}
		if (r.endlessTime() > r.elapsedTime()) {
			throw invalid("tempo na Era Sem Fim maior que o tempo total");
		}
	}

	private static ApiException invalid(String reason) {
		return new ApiException(ErrorCode.VALIDATION_ERROR, "Run inconsistente: " + reason + ".");
	}
}
