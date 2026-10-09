package com.dinomutation.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** A refresh token as stored: only its SHA-256, never the value sent in the cookie. */
@Entity
@Table(name = "refresh_token")
public class RefreshToken {

	@Id
	private UUID id;

	@Column(nullable = false)
	private UUID playerId;

	@Column(nullable = false)
	private String tokenHash;

	@Column(nullable = false)
	private Instant expiresAt;

	private Instant revokedAt;

	@Column(nullable = false)
	private Instant createdAt;

	protected RefreshToken() {
	}

	public RefreshToken(UUID playerId, String tokenHash, Instant now, Duration ttl) {
		this.id = UUID.randomUUID();
		this.playerId = playerId;
		this.tokenHash = tokenHash;
		this.createdAt = now;
		this.expiresAt = now.plus(ttl);
	}

	public UUID getPlayerId() {
		return playerId;
	}

	public boolean isRevoked() {
		return revokedAt != null;
	}

	public boolean isExpired(Instant now) {
		return !now.isBefore(expiresAt);
	}

	public void revoke(Instant now) {
		revokedAt = now;
	}
}
