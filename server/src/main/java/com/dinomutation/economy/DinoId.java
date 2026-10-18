package com.dinomutation.economy;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Playable dinosaurs; `id` is the value used by the game, the JSON and the database. */
public enum DinoId {
	TREX("trex"), RAPTOR("raptor"), TRICERATOPS("triceratops");

	private final String id;

	DinoId(String id) {
		this.id = id;
	}

	@JsonValue
	public String id() {
		return id;
	}

	@JsonCreator
	public static DinoId fromId(String id) {
		for (DinoId d : values()) {
			if (d.id.equals(id)) {
				return d;
			}
		}
		throw new IllegalArgumentException("Dinossauro desconhecido: " + id);
	}
}
