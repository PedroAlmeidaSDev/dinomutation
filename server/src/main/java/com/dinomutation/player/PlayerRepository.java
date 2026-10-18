package com.dinomutation.player;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

	Optional<Player> findByEmail(String email);

	Optional<Player> findByGoogleSub(String googleSub);

	boolean existsByEmail(String email);

	/** The player behind an access token; a missing row means the token is no longer valid. */
	default Player getRequired(UUID id) {
		return findById(id).orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "Conta não encontrada."));
	}
}
