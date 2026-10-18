package com.dinomutation.auth;

/** What a successful sign-in produces: an access token for the body, a refresh token for the cookie. */
public record Session(AccessToken accessToken, String refreshToken) {}
