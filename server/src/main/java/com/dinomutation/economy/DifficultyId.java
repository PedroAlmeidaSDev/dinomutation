package com.dinomutation.economy;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Difficulty ladder in unlock order (the ordinal is the index stored in dino_progress.cleared_index). */
public enum DifficultyId {
	FILHOTE("filhote"), NORMAL("normal"), PREDADOR("predador"), EXTINCAO("extincao");

	private final String id;

	DifficultyId(String id) {
		this.id = id;
	}

	@JsonValue
	public String id() {
		return id;
	}

	@JsonCreator
	public static DifficultyId fromId(String id) {
		for (DifficultyId d : values()) {
			if (d.id.equals(id)) {
				return d;
			}
		}
		throw new IllegalArgumentException("Dificuldade desconhecida: " + id);
	}
}
