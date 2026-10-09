package com.dinomutation.auth;

/** A signed access token and its lifetime in seconds. */
public record AccessToken(String value, long expiresIn) {}
