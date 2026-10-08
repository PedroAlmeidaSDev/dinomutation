package com.dinomutation.economy;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.json.JsonMapper;

/** Same cases as client/tools/economy/economy-test.ts: both sides must pay the same. */
class EconomyParityTest {

	record Cases(List<RunCase> runs, List<LevelCase> masteryLevels) {}
	record RunCase(String name, Input input, Expected expected) {}
	record Input(String difficulty, double elapsedTime, int kills, boolean eliteKilled, boolean bossKilled) {}
	record Expected(int fossils, int masteryXp) {}
	record LevelCase(int xp, int level) {}

	private final Economy economy = Economy.loadDefault();
	private final Cases cases = JsonMapper.builder().build()
			.readValue(Path.of("..", "shared", "economy-cases.json").toFile(), Cases.class);

	@TestFactory
	Stream<DynamicTest> runRewardsMatchTheClient() {
		return cases.runs().stream().map(c -> DynamicTest.dynamicTest(c.name(), () -> {
			RunFacts facts = new RunFacts(DifficultyId.fromId(c.input().difficulty()), c.input().elapsedTime(),
					c.input().kills(), c.input().eliteKilled(), c.input().bossKilled());
			assertThat(economy.fossilsForRun(facts)).as("fósseis").isEqualTo(c.expected().fossils());
			assertThat(economy.masteryXpForRun(facts)).as("XP de maestria").isEqualTo(c.expected().masteryXp());
		}));
	}

	@TestFactory
	Stream<DynamicTest> masteryLevelsMatchTheClient() {
		return cases.masteryLevels().stream().map(c -> DynamicTest.dynamicTest(c.xp() + " XP",
				() -> assertThat(economy.masteryLevel(c.xp())).isEqualTo(c.level())));
	}

}
