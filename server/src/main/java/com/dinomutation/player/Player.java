package com.dinomutation.player;

import com.dinomutation.economy.DinoId;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * A player account and all of its progress (one aggregate). Progress per dinosaur and shop
 * levels are element collections, so the @Version on this row guards every change to them.
 */
@Entity
@Table(name = "player")
public class Player {

	@Id
	private UUID id;

	@Column(nullable = false)
	private String email;

	private String passwordHash;

	private String googleSub;

	@Column(nullable = false)
	private String displayName;

	private int fossils;
	private int runs;
	private int wins;
	private int endlessRuns;
	private double bestTime;
	private int bestEra;
	private String lastDino;
	private String seenPatch;
	private Instant importedAt;

	@Version
	private Long version;

	@Column(nullable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	@ElementCollection
	@CollectionTable(name = "dino_progress", joinColumns = @JoinColumn(name = "player_id"))
	@MapKeyColumn(name = "dino")
	private Map<String, DinoProgress> dinos = new HashMap<>();

	@ElementCollection
	@CollectionTable(name = "shop_level", joinColumns = @JoinColumn(name = "player_id"))
	@Column(name = "level")
	private Map<ShopKey, Integer> shop = new HashMap<>();

	protected Player() {
	}

	public static Player create(String email, String displayName, Instant now) {
		Player p = new Player();
		p.id = UUID.randomUUID();
		p.email = email;
		p.displayName = displayName;
		p.createdAt = now;
		p.updatedAt = now;
		return p;
	}

	@PrePersist
	@PreUpdate
	void touch() {
		updatedAt = Instant.now();
	}

	/** Progress with a dinosaur, created on first use. */
	public DinoProgress progress(DinoId dino) {
		return dinos.computeIfAbsent(dino.id(), k -> new DinoProgress());
	}

	/** Highest difficulty index beaten with `dino` (-1 = none), without creating progress. */
	public int clearedIndex(DinoId dino) {
		DinoProgress d = dinos.get(dino.id());
		return d == null ? -1 : d.getClearedIndex();
	}

	public int shopLevel(DinoId dino, String itemId) {
		return shop.getOrDefault(new ShopKey(dino.id(), itemId), 0);
	}

	public void setShopLevel(DinoId dino, String itemId, int level) {
		shop.put(new ShopKey(dino.id(), itemId), level);
	}

	public void addFossils(int amount) {
		fossils += amount;
	}

	public void spendFossils(int amount) {
		if (amount > fossils) {
			throw new IllegalStateException("Fósseis insuficientes");
		}
		fossils -= amount;
	}

	public UUID getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public void setPasswordHash(String passwordHash) {
		this.passwordHash = passwordHash;
	}

	public String getGoogleSub() {
		return googleSub;
	}

	public void setGoogleSub(String googleSub) {
		this.googleSub = googleSub;
	}

	public String getDisplayName() {
		return displayName;
	}

	public int getFossils() {
		return fossils;
	}

	public int getRuns() {
		return runs;
	}

	public void setRuns(int runs) {
		this.runs = runs;
	}

	public int getWins() {
		return wins;
	}

	public void setWins(int wins) {
		this.wins = wins;
	}

	public int getEndlessRuns() {
		return endlessRuns;
	}

	public void setEndlessRuns(int endlessRuns) {
		this.endlessRuns = endlessRuns;
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

	public String getLastDino() {
		return lastDino;
	}

	public void setLastDino(String lastDino) {
		this.lastDino = lastDino;
	}

	public String getSeenPatch() {
		return seenPatch;
	}

	public void setSeenPatch(String seenPatch) {
		this.seenPatch = seenPatch;
	}

	public Instant getImportedAt() {
		return importedAt;
	}

	public void setImportedAt(Instant importedAt) {
		this.importedAt = importedAt;
	}

	public Map<String, DinoProgress> getDinos() {
		return dinos;
	}

	public Map<ShopKey, Integer> getShop() {
		return shop;
	}
}
