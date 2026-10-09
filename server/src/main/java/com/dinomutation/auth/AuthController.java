package com.dinomutation.auth;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService auth;
	private final RefreshCookies cookies;

	public AuthController(AuthService auth, RefreshCookies cookies) {
		this.auth = auth;
		this.cookies = cookies;
	}

	@PostMapping("/register")
	public ResponseEntity<TokenResponse> register(@Valid @RequestBody RegisterRequest req) {
		return respond(HttpStatus.CREATED, auth.register(req));
	}

	@PostMapping("/login")
	public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest req) {
		return respond(HttpStatus.OK, auth.login(req));
	}

	private ResponseEntity<TokenResponse> respond(HttpStatus status, Session session) {
		return ResponseEntity.status(status)
				.header(HttpHeaders.SET_COOKIE, cookies.issue(session.refreshToken()).toString())
				.body(new TokenResponse(session.accessToken().value(), session.accessToken().expiresIn()));
	}
}
