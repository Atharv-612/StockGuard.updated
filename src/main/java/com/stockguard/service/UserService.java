package com.stockguard.service;

import com.stockguard.dto.AuthDtos.*;
import com.stockguard.exception.ApiException;
import com.stockguard.model.User;
import com.stockguard.repository.UserRepository;
import com.stockguard.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        User user = new User();
        user.setOwnerName(req.ownerName().trim());
        user.setShopName(req.shopName().trim());
        user.setEmail(email);
        user.setPhoneNumber(cleanNumber(req.phoneNumber()));
        user.setPassword(passwordEncoder.encode(req.password()));
        users.save(user);
        return new AuthResponse(jwtService.createToken(user), UserDto.from(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        User user = users.findByEmailIgnoreCase(req.email().trim())
                .filter(u -> passwordEncoder.matches(req.password(), u.getPassword()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Wrong email or password"));
        return new AuthResponse(jwtService.createToken(user), UserDto.from(user));
    }

    @Transactional(readOnly = true)
    public User getUser(Long id) {
        return users.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Account not found, please log in again"));
    }

    @Transactional
    public UserDto updateSettings(Long userId, SettingsRequest req) {
        User user = getUser(userId);
        user.setOwnerName(req.ownerName().trim());
        user.setShopName(req.shopName().trim());
        user.setPhoneNumber(cleanNumber(req.phoneNumber()));
        user.setExpiryAlertDays(req.expiryAlertDays());
        user.setAlertsEnabled(req.alertsEnabled());
        return UserDto.from(users.save(user));
    }

    private static String cleanNumber(String number) {
        if (number == null || number.isBlank()) return null;
        return number.replaceAll("[^0-9+]", "");
    }
}
