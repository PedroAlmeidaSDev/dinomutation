package com.dinomutation.player;

import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Partial update: null fields are left untouched. */
public record PreferencesRequest(@Size(max = 20) String seenPatch, @Valid DifficultyPreference difficulty) {

	public record DifficultyPreference(@NotNull DinoId dino, @NotNull DifficultyId id) {}
}
