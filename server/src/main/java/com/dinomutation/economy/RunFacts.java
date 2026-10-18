package com.dinomutation.economy;

/** What a finished run reports that the economy pays for. */
public record RunFacts(DifficultyId difficulty, double elapsedTime, int kills, boolean eliteKilled, boolean bossKilled) {}
