package com.dinomutation.shop;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.Economy;
import com.dinomutation.economy.EconomyConfig;
import com.dinomutation.player.Player;
import com.dinomutation.player.PlayerRepository;
import com.dinomutation.player.SaveDto;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The Covil shop: prices come from economy.json and the balance is checked and debited atomically. */
@Service
public class ShopService {

	private final PlayerRepository players;
	private final Economy economy;

	public ShopService(PlayerRepository players, Economy economy) {
		this.players = players;
		this.economy = economy;
	}

	@Transactional
	public SaveDto purchase(UUID playerId, PurchaseRequest req) {
		Player player = players.getRequired(playerId);
		EconomyConfig.ShopItem item = economy.shopItem(req.dino(), req.itemId())
				.orElseThrow(() -> new ApiException(ErrorCode.ITEM_NOT_FOUND, "Este item não existe na loja deste dinossauro."));
		int level = player.shopLevel(req.dino(), item.id());
		if (level >= item.costs().size()) {
			throw new ApiException(ErrorCode.ITEM_MAXED, "Este item já está no nível máximo.");
		}
		int cost = item.costs().get(level);
		if (player.getFossils() < cost) {
			throw new ApiException(ErrorCode.INSUFFICIENT_FOSSILS, "Fósseis insuficientes.");
		}
		player.spendFossils(cost);
		player.setShopLevel(req.dino(), item.id(), level + 1);
		return SaveDto.of(player);
	}
}
