package com.dinomutation.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

	Optional<RefreshToken> findByTokenHash(String tokenHash);

	@Modifying
	@Query("update RefreshToken t set t.revokedAt = :now where t.playerId = :playerId and t.revokedAt is null")
	int revokeAllForPlayer(UUID playerId, Instant now);

	/** Atomically spends a token; returns 0 when it was already revoked (e.g. by a concurrent request). */
	@Modifying
	@Query("update RefreshToken t set t.revokedAt = :now where t.id = :id and t.revokedAt is null")
	int markRevokedIfActive(UUID id, Instant now);
}
