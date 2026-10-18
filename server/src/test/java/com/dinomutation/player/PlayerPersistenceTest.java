package com.dinomutation.player;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dinomutation.IntegrationTest;
import com.dinomutation.economy.DinoId;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionTemplate;

class PlayerPersistenceTest extends IntegrationTest {

	@Autowired
	PlayerRepository players;

	@Autowired
	TransactionTemplate tx;

	@Test
	void persistsProgressAndShopAndBuildsTheSave() {
		UUID id = tx.execute(s -> {
			Player p = Player.create("pedro@example.com", "Pedro", Instant.now());
			p.addFossils(820);
			p.setRuns(34);
			p.setWins(9);
			p.setBestTime(1210.5);
			p.setLastDino("trex");
			DinoProgress trex = p.progress(DinoId.TREX);
			trex.setMasteryXp(640);
			trex.setClearedIndex(1);
			trex.setPreferredDifficulty("predador");
			trex.setBestTime(1210.5);
			trex.setBestEra(3);
			p.progress(DinoId.RAPTOR).setMasteryXp(10);
			p.setShopLevel(DinoId.TREX, "meta_vida", 3);
			return players.save(p).getId();
		});

		SaveDto save = tx.execute(s -> SaveDto.of(players.findById(id).orElseThrow()));

		assertThat(save.email()).isEqualTo("pedro@example.com");
		assertThat(save.fossils()).isEqualTo(820);
		assertThat(save.runs()).isEqualTo(34);
		assertThat(save.lastDino()).isEqualTo("trex");
		assertThat(save.mastery()).containsEntry("trex", 640).containsEntry("raptor", 10);
		assertThat(save.cleared()).containsOnlyKeys("trex").containsEntry("trex", 1);
		assertThat(save.difficulty()).containsOnlyKeys("trex").containsEntry("trex", "predador");
		assertThat(save.bestEraByDino()).containsOnlyKeys("trex");
		assertThat(save.shop()).containsEntry("trex", Map.of("meta_vida", 3));
	}

	@Test
	void clearedIndexDoesNotCreateProgress() {
		Player p = Player.create("x@example.com", "X", Instant.now());
		assertThat(p.clearedIndex(DinoId.TREX)).isEqualTo(-1);
		assertThat(p.getDinos()).isEmpty();
	}

	@Test
	void databaseRejectsNegativeFossils() {
		UUID id = tx.execute(s -> players.save(Player.create("y@example.com", "Y", Instant.now())).getId());
		assertThatThrownBy(() -> jdbc.update("update player set fossils = -1 where id = ?", id))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

}
