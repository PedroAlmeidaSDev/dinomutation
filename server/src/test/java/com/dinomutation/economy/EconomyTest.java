package com.dinomutation.economy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EconomyTest {

	private final Economy economy = Economy.loadDefault();

	@Test
	void readsTheSharedFile() {
		assertThat(economy.difficulty(DifficultyId.PREDADOR).fossilMult()).isEqualTo(1.4);
		assertThat(economy.difficulty(DifficultyId.NORMAL).firstWinBonus()).isEqualTo(150);
		assertThat(economy.lastDifficultyIndex()).isEqualTo(3);
	}

	@Test
	void unlockLadderFollowsTheGame() {
		assertThat(economy.highestUnlocked(-1)).isZero();
		assertThat(economy.highestUnlocked(0)).isEqualTo(1);
		assertThat(economy.highestUnlocked(3)).isEqualTo(3);
		assertThat(economy.isUnlocked(DifficultyId.FILHOTE, -1)).isTrue();
		assertThat(economy.isUnlocked(DifficultyId.NORMAL, -1)).isFalse();
		assertThat(economy.isUnlocked(DifficultyId.NORMAL, 0)).isTrue();
	}

	@Test
	void nextDifficulty() {
		assertThat(economy.next(DifficultyId.FILHOTE)).contains(DifficultyId.NORMAL);
		assertThat(economy.next(DifficultyId.EXTINCAO)).isEmpty();
	}

	@Test
	void shopItemsArePerDino() {
		assertThat(economy.shopItem(DinoId.TREX, "meta_trex_crit")).get()
				.extracting(EconomyConfig.ShopItem::costs).isEqualTo(List.of(30, 70, 150, 300, 480));
		assertThat(economy.shopItem(DinoId.RAPTOR, "meta_trex_crit")).isEmpty();
	}

	@Test
	void idsRoundTrip() {
		assertThat(DinoId.fromId("triceratops")).isEqualTo(DinoId.TRICERATOPS);
		assertThat(DifficultyId.EXTINCAO.id()).isEqualTo("extincao");
		assertThatThrownBy(() -> DinoId.fromId("stego")).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void rejectsAConfigWhoseDinosDivergeFromTheEnum() {
		EconomyConfig bad = new EconomyConfig(List.of("trex"),
				new EconomyConfig.Fossils(15, 60, 40, 120), new EconomyConfig.Mastery(4, 40, 100, 10, 100),
				List.of(new EconomyConfig.Difficulty("filhote", 0.75, 60), new EconomyConfig.Difficulty("normal", 1, 150),
						new EconomyConfig.Difficulty("predador", 1.4, 250), new EconomyConfig.Difficulty("extincao", 1.8, 400)),
				Map.of());
		assertThatThrownBy(() -> new Economy(bad)).isInstanceOf(IllegalStateException.class).hasMessageContaining("dinos");
	}

}
