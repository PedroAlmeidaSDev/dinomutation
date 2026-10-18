package com.dinomutation.shop;

import com.dinomutation.economy.DinoId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PurchaseRequest(@NotNull DinoId dino, @NotBlank @Size(max = 40) String itemId) {}
