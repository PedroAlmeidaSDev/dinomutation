package com.dinomutation.auth;

/** A Google account proven by a verified ID token. */
public record GoogleIdentity(String subject, String email, String name) {}
