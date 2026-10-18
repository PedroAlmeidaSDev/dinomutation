package com.dinomutation.player;

import com.dinomutation.common.CurrentPlayer;
import com.dinomutation.common.OptimisticRetry;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/players/me")
public class PlayerController {

	private final PlayerService service;
	private final OptimisticRetry retry;

	public PlayerController(PlayerService service, OptimisticRetry retry) {
		this.service = service;
		this.retry = retry;
	}

	@GetMapping("/save")
	public SaveDto save(@AuthenticationPrincipal Jwt jwt) {
		return service.loadSave(CurrentPlayer.id(jwt));
	}

	@PatchMapping("/preferences")
	public ResponseEntity<Void> preferences(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PreferencesRequest req) {
		retry.once(() -> {
			service.updatePreferences(CurrentPlayer.id(jwt), req);
			return null;
		});
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/import")
	public SaveDto importSave(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ImportRequest req) {
		return retry.once(() -> service.importSave(CurrentPlayer.id(jwt), req.save()));
	}
}
