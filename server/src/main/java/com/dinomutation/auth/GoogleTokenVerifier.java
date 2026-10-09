package com.dinomutation.auth;

/** Checks a Google ID token; throws ApiException(INVALID_CREDENTIALS) when it can't be trusted. */
public interface GoogleTokenVerifier {

	GoogleIdentity verify(String idToken);
}
