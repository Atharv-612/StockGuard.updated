package com.stockguard.security;

/** The logged-in shop owner, taken from the JWT and available via @AuthenticationPrincipal. */
public record AuthUser(Long id, String email) {}
