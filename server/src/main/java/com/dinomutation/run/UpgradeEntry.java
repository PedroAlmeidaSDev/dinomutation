package com.dinomutation.run;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** One mutation picked during the run (history only; never used to pay anything). */
public record UpgradeEntry(
		@NotBlank @Size(max = 60) String id,
		@Size(max = 80) String name,
		@Size(max = 20) String rarity,
		@Min(1) int level) {}
