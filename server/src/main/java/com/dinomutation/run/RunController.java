package com.dinomutation.run;

import com.dinomutation.common.CurrentPlayer;
import com.dinomutation.common.OptimisticRetry;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class RunController {

	private final RunService service;
	private final OptimisticRetry retry;

	public RunController(RunService service, OptimisticRetry retry) {
		this.service = service;
		this.retry = retry;
	}

	@PostMapping("/runs")
	public ResponseEntity<RunResponse> recordRun(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RunRequest req) {
		RunOutcome outcome = retry.once(() -> service.recordRun(CurrentPlayer.id(jwt), req));
		return ResponseEntity.status(outcome.created() ? HttpStatus.CREATED : HttpStatus.OK).body(outcome.response());
	}

	@PostMapping("/clears")
	public ClearResponse recordClear(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ClearRequest req) {
		return retry.once(() -> service.recordClear(CurrentPlayer.id(jwt), req));
	}
}
