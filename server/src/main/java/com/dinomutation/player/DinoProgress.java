package com.dinomutation.player;

import jakarta.persistence.Embeddable;

/** One row of dino_progress: a player's progress with one dinosaur. */
@Embeddable
public class DinoProgress {

	private int masteryXp;
	private int clearedIndex = -1;
	private String preferredDifficulty;
	private double bestTime;
	private int bestEra;

	public int getMasteryXp() {
		return masteryXp;
	}

	public void setMasteryXp(int masteryXp) {
		this.masteryXp = masteryXp;
	}

	/** Index of the highest difficulty beaten (-1 = none). */
	public int getClearedIndex() {
		return clearedIndex;
	}

	public void setClearedIndex(int clearedIndex) {
		this.clearedIndex = clearedIndex;
	}

	public String getPreferredDifficulty() {
		return preferredDifficulty;
	}

	public void setPreferredDifficulty(String preferredDifficulty) {
		this.preferredDifficulty = preferredDifficulty;
	}

	public double getBestTime() {
		return bestTime;
	}

	public void setBestTime(double bestTime) {
		this.bestTime = bestTime;
	}

	public int getBestEra() {
		return bestEra;
	}

	public void setBestEra(int bestEra) {
		this.bestEra = bestEra;
	}
}
