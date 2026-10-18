package com.dinomutation.auth;

public record TokenResponse(String accessToken, long expiresIn) {}
