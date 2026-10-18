package com.dinomutation.common;

import com.dinomutation.economy.Economy;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {

	@Bean
	Economy economy() {
		return Economy.loadDefault();
	}

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}
}
