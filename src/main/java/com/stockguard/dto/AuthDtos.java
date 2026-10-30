package com.stockguard.dto;

import com.stockguard.model.User;
import jakarta.validation.constraints.*;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank(message = "Owner name is required") @Size(max = 100) String ownerName,
            @NotBlank(message = "Shop name is required") @Size(max = 150) String shopName,
            @NotBlank(message = "Email is required") @Email(message = "Enter a valid email") String email,
            @Pattern(regexp = "^$|^\\+?[0-9 ]{10,16}$", message = "Enter a valid phone number") String phoneNumber,
            @NotBlank @Size(min = 6, message = "Password must be at least 6 characters") String password) {}

    public record LoginRequest(
            @NotBlank(message = "Email is required") String email,
            @NotBlank(message = "Password is required") String password) {}

    public record SettingsRequest(
            @NotBlank(message = "Owner name is required") @Size(max = 100) String ownerName,
            @NotBlank(message = "Shop name is required") @Size(max = 150) String shopName,
            @Pattern(regexp = "^$|^\\+?[0-9 ]{10,16}$", message = "Enter a valid phone number") String phoneNumber,
            @Min(value = 1, message = "Alert days must be at least 1") @Max(value = 90, message = "Alert days must be at most 90") int expiryAlertDays,
            boolean alertsEnabled) {}

    public record UserDto(Long id, String ownerName, String shopName, String email, String phoneNumber,
                          int expiryAlertDays, boolean alertsEnabled) {
        public static UserDto from(User u) {
            return new UserDto(u.getId(), u.getOwnerName(), u.getShopName(), u.getEmail(), u.getPhoneNumber(),
                    u.getExpiryAlertDays(), u.isAlertsEnabled());
        }
    }

    public record AuthResponse(String token, UserDto user) {}
}
