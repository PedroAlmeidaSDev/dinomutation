package com.dinomutation.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.dinomutation.IntegrationTest;
import com.dinomutation.common.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class RefreshTokenRaceTest extends IntegrationTest {

	@Autowired
	private RefreshTokenService refreshTokens;

	@Test
	void concurrentConsumeOfTheSameTokenSucceedsOnceAndRevokesEverything() throws Exception {
		newPlayerToken("pedro@example.com");
		UUID playerId = jdbc.queryForObject("select id from player", UUID.class);
		String token = refreshTokens.create(playerId);

		int threads = 4;
		CountDownLatch ready = new CountDownLatch(threads);
		CountDownLatch go = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(threads);
		try {
			List<Future<Boolean>> results = new ArrayList<>();
			for (int i = 0; i < threads; i++) {
				Callable<Boolean> task = () -> {
					ready.countDown();
					go.await();
					try {
						refreshTokens.consume(token);
						return true;
					} catch (ApiException e) {
						return false;
					}
				};
				results.add(pool.submit(task));
			}
			ready.await();
			go.countDown();
			int successes = 0;
			for (Future<Boolean> f : results) {
				if (f.get()) {
					successes++;
				}
			}
			assertThat(successes).isEqualTo(1);
		} finally {
			pool.shutdownNow();
		}

		assertThat(jdbc.queryForObject("select count(*) from refresh_token where revoked_at is null", Integer.class))
				.isZero();
	}
}
