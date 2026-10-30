package com.stockguard.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Settings under the "stockguard" prefix in application.properties. */
@ConfigurationProperties(prefix = "stockguard")
public record AppProperties(Jwt jwt, Alerts alerts) {

    public record Jwt(String secret, long expirationHours) {}

    /** cron: when the daily alert digest runs. */
    public record Alerts(String cron, String zone) {}
}
