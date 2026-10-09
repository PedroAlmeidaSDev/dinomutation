package com.dinomutation.common;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(Jwt jwt, Google google, Cookie cookie) {

	public record Jwt(String secret, Duration accessTtl, Duration refreshTtl) {}

	public record Google(String clientId) {}

	public record Cookie(boolean secure) {}
}
