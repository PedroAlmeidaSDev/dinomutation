package com.dinomutation.run;

import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import jakarta.validation.constraints.NotNull;

public record ClearRequest(@NotNull DinoId dino, @NotNull DifficultyId difficulty) {}
