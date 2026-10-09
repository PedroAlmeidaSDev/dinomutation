package com.dinomutation.player;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ImportRequest(@NotNull @Valid ImportedSave save) {}
