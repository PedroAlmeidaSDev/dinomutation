package com.dinomutation.leaderboard;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.CurrentPlayer;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.function.Function;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public ranking of the longest survival times; a bearer token adds the caller's own place. */
@RestController
@RequestMapping("/api/leaderboard")
public class LeaderboardController {

	private final LeaderboardService service;

	public LeaderboardController(LeaderboardService service) {
		this.service = service;
	}

	@GetMapping
	public LeaderboardResponse leaderboard(
			@RequestParam(required = false) String dino,
			@RequestParam(required = false) String difficulty,
			@RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit,
			@AuthenticationPrincipal Jwt jwt) {
		return service.leaderboard(parse(dino, DinoId::fromId), parse(difficulty, DifficultyId::fromId), limit,
				jwt == null ? null : CurrentPlayer.id(jwt));
	}

	/** Request ids are lower-case ("trex"), so Spring's enum-name conversion doesn't apply. */
	private static <T> T parse(String value, Function<String, T> fromId) {
		if (value == null || value.isBlank()) {
			return null;
		}
		try {
			return fromId.apply(value);
		} catch (IllegalArgumentException e) {
			throw new ApiException(ErrorCode.VALIDATION_ERROR, e.getMessage());
		}
	}
}
