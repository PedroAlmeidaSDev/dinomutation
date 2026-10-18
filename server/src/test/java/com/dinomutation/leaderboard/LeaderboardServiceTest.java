package com.dinomutation.leaderboard;

import static org.assertj.core.api.Assertions.assertThat;

import com.dinomutation.common.AppProperties;
import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/**
 * Plain unit test (no Spring context): the leaderboard query scans the whole run table, so
 * {@link LeaderboardService} caches the `entries` list in memory. A fake repository counts calls
 * instead of hitting a database, and a mutable clock drives the TTL without sleeping.
 */
class LeaderboardServiceTest {

	private static final UUID SOMEONE = UUID.randomUUID();

	@Test
	void repeatingTheSameFilterWithinTheTtlHitsTheRepositoryOnce() {
		CountingRepository repository = new CountingRepository();
		LeaderboardService service = service(repository, new MutableClock(), Duration.ofSeconds(30));

		service.leaderboard(DinoId.TREX, null, 20, null);
		service.leaderboard(DinoId.TREX, null, 20, null);

		assertThat(repository.topCalls.get()).isEqualTo(1);
	}

	@Test
	void callingAgainAfterTheTtlHitsTheRepositoryAgain() {
		CountingRepository repository = new CountingRepository();
		MutableClock clock = new MutableClock();
		LeaderboardService service = service(repository, clock, Duration.ofSeconds(30));

		service.leaderboard(DinoId.TREX, null, 20, null);
		clock.advance(Duration.ofSeconds(31));
		service.leaderboard(DinoId.TREX, null, 20, null);

		assertThat(repository.topCalls.get()).isEqualTo(2);
	}

	@Test
	void differentFiltersDoNotShareTheCachedEntries() {
		CountingRepository repository = new CountingRepository();
		LeaderboardService service = service(repository, new MutableClock(), Duration.ofSeconds(30));

		service.leaderboard(DinoId.TREX, null, 20, null);
		service.leaderboard(DinoId.RAPTOR, null, 20, null);
		service.leaderboard(DinoId.TREX, DifficultyId.FILHOTE, 20, null);
		service.leaderboard(DinoId.TREX, null, 10, null);

		assertThat(repository.topCalls.get()).isEqualTo(4);
	}

	@Test
	void aZeroTtlMeansEveryCallHitsTheRepository() {
		CountingRepository repository = new CountingRepository();
		LeaderboardService service = service(repository, new MutableClock(), Duration.ZERO);

		service.leaderboard(DinoId.TREX, null, 20, null);
		service.leaderboard(DinoId.TREX, null, 20, null);

		assertThat(repository.topCalls.get()).isEqualTo(2);
	}

	@Test
	void meIsNeverCachedAndAlwaysComesFromTheRepository() {
		CountingRepository repository = new CountingRepository();
		LeaderboardService service = service(repository, new MutableClock(), Duration.ofSeconds(30));

		service.leaderboard(DinoId.TREX, null, 20, SOMEONE);
		service.leaderboard(DinoId.TREX, null, 20, SOMEONE);

		assertThat(repository.placeOfCalls.get()).isEqualTo(2);
		assertThat(repository.topCalls.get()).isEqualTo(1);
	}

	private static LeaderboardService service(CountingRepository repository, Clock clock, Duration ttl) {
		AppProperties properties = new AppProperties(null, null, null, new AppProperties.Leaderboard(ttl));
		return new LeaderboardService(repository, clock, properties);
	}

	/** Counts calls instead of hitting a database; never actually uses the JDBC template. */
	private static class CountingRepository extends LeaderboardRepository {
		final AtomicInteger topCalls = new AtomicInteger();
		final AtomicInteger placeOfCalls = new AtomicInteger();

		CountingRepository() {
			super(null);
		}

		@Override
		public List<LeaderboardEntry> top(String dino, String difficulty, int limit) {
			topCalls.incrementAndGet();
			return List.of(new LeaderboardEntry(1, "Ana", 100, dino, difficulty, 0, Instant.EPOCH));
		}

		@Override
		public Optional<LeaderboardEntry> placeOf(UUID playerId, String dino, String difficulty) {
			placeOfCalls.incrementAndGet();
			return Optional.empty();
		}
	}

	/** Fixed instant that advances only when the test tells it to. */
	private static class MutableClock extends Clock {
		private Instant now = Instant.parse("2026-10-09T00:00:00Z");

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			throw new UnsupportedOperationException();
		}

		@Override
		public Instant instant() {
			return now;
		}

		void advance(Duration duration) {
			now = now.plus(duration);
		}
	}
}
