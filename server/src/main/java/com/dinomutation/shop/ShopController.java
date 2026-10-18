package com.dinomutation.shop;

import com.dinomutation.common.CurrentPlayer;
import com.dinomutation.common.OptimisticRetry;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shop")
public class ShopController {

	private final ShopService service;
	private final OptimisticRetry retry;

	public ShopController(ShopService service, OptimisticRetry retry) {
		this.service = service;
		this.retry = retry;
	}

	@PostMapping("/purchases")
	public PurchaseResponse purchase(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PurchaseRequest req) {
		return new PurchaseResponse(retry.once(() -> service.purchase(CurrentPlayer.id(jwt), req)));
	}
}
