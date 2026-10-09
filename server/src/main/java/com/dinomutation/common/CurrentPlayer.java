package com.dinomutation.common;

import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

/** The signed-in player is the access token's subject. */
public final class CurrentPlayer {

	private CurrentPlayer() {
	}

	public static UUID id(Jwt jwt) {
		return UUID.fromString(jwt.getSubject());
	}
}
