package com.dinomutation.player;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Key of shop_level: an item of one dinosaur's shop. */
@Embeddable
public record ShopKey(@Column(name = "dino") String dino, @Column(name = "item_id") String itemId) {}
