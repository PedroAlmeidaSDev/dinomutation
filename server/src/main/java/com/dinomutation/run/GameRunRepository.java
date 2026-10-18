package com.dinomutation.run;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRunRepository extends JpaRepository<GameRun, UUID> {}
