package com.dinomutation.player;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerService {

	private final PlayerRepository players;
	private final ProgressRules rules;
	private final SaveImporter importer;
	private final Clock clock;

	public PlayerService(PlayerRepository players, ProgressRules rules, SaveImporter importer, Clock clock) {
		this.players = players;
		this.rules = rules;
		this.importer = importer;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public SaveDto loadSave(UUID playerId) {
		return SaveDto.of(players.getRequired(playerId));
	}

	@Transactional
	public void updatePreferences(UUID playerId, PreferencesRequest req) {
		Player player = players.getRequired(playerId);
		if (req.seenPatch() != null) {
			player.setSeenPatch(req.seenPatch());
		}
		if (req.difficulty() != null) {
			rules.requireUnlocked(player, req.difficulty().dino(), req.difficulty().id());
			player.progress(req.difficulty().dino()).setPreferredDifficulty(req.difficulty().id().id());
		}
	}

	/** One-time copy of the browser save into an account without progress (spec: the cloud wins otherwise). */
	@Transactional
	public SaveDto importSave(UUID playerId, ImportedSave save) {
		Player player = players.getRequired(playerId);
		if (player.getImportedAt() != null || player.getRuns() > 0) {
			throw new ApiException(ErrorCode.ALREADY_IMPORTED, "Esta conta já tem progresso; o save do navegador não foi importado.");
		}
		importer.apply(player, save);
		player.setImportedAt(clock.instant());
		return SaveDto.of(player);
	}
}
