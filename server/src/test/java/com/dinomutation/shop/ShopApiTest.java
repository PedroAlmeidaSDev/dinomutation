package com.dinomutation.shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class ShopApiTest extends IntegrationTest {

	private String token;

	@BeforeEach
	void signUp() throws Exception {
		token = newPlayerToken("pedro@example.com");
	}

	private void setFossils(int fossils) {
		jdbc.update("update player set fossils = ?", fossils);
	}

	private ResultActions buy(String dino, String itemId) throws Exception {
		return mvc.perform(post("/api/shop/purchases").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(json("dino", dino, "itemId", itemId)));
	}

	@Test
	void purchaseDebitsAndRaisesTheLevel() throws Exception {
		setFossils(100);
		buy("trex", "meta_vida").andExpect(status().isOk())
				.andExpect(jsonPath("$.save.fossils").value(70))
				.andExpect(jsonPath("$.save.shop.trex.meta_vida").value(1));
		buy("trex", "meta_vida").andExpect(status().isOk())
				.andExpect(jsonPath("$.save.fossils").value(0))
				.andExpect(jsonPath("$.save.shop.trex.meta_vida").value(2));
	}

	@Test
	void notEnoughFossilsIs409() throws Exception {
		setFossils(10);
		buy("trex", "meta_vida").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_FOSSILS"));
	}

	@Test
	void maxedItemIs409() throws Exception {
		setFossils(5000);
		for (int i = 0; i < 5; i++) {
			buy("trex", "meta_vida").andExpect(status().isOk());
		}
		buy("trex", "meta_vida").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ITEM_MAXED"));
	}

	@Test
	void itemFromAnotherDinosShopIs404() throws Exception {
		setFossils(100);
		buy("trex", "meta_raptor_claw").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ITEM_NOT_FOUND"));
	}

	@Test
	void twoSimultaneousPurchasesWithFundsForOneOnlyChargeOnce() throws Exception {
		setFossils(30);
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			List<Future<Integer>> results = new ArrayList<>();
			for (String item : List.of("meta_vida", "meta_dano")) {
				Callable<Integer> call = () -> {
					start.await();
					return buy("trex", item).andReturn().getResponse().getStatus();
				};
				results.add(pool.submit(call));
			}
			start.countDown();
			List<Integer> statuses = new ArrayList<>();
			for (Future<Integer> f : results) {
				statuses.add(f.get());
			}
			assertThat(statuses).containsExactlyInAnyOrder(200, 409);
		} finally {
			pool.shutdown();
		}
		assertThat(jdbc.queryForObject("select fossils from player", Integer.class)).isZero();
		assertThat(jdbc.queryForObject("select count(*) from shop_level", Integer.class)).isEqualTo(1);
	}

}
