package com.dinomutation.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import org.junit.jupiter.api.Test;

class OpenApiTest extends IntegrationTest {

	@Test
	void documentsTheGameEndpointsAndBearerAuth() throws Exception {
		mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
				.andExpect(jsonPath("$.info.title").value("DinoMutation API"))
				.andExpect(jsonPath("$.paths['/api/runs']").exists())
				.andExpect(jsonPath("$.paths['/api/shop/purchases']").exists())
				.andExpect(jsonPath("$.components.securitySchemes.bearer.scheme").value("bearer"));
	}

}
