package com.dinomutation.auth;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Google stand-in for tests: accepts tokens shaped "valid:<sub>:<email>:<name>". */
public class FakeGoogleTokenVerifier implements GoogleTokenVerifier {

	@Override
	public GoogleIdentity verify(String idToken) {
		String[] parts = idToken.split(":", 4);
		if (parts.length != 4 || !parts[0].equals("valid")) {
			throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Token do Google inválido.");
		}
		return new GoogleIdentity(parts[1], parts[2], parts[3]);
	}

	@TestConfiguration(proxyBeanMethods = false)
	public static class Config {

		@Bean
		@Primary
		GoogleTokenVerifier fakeGoogleTokenVerifier() {
			return new FakeGoogleTokenVerifier();
		}
	}
}
