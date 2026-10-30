package com.stockguard.controller;

import com.stockguard.dto.AuthDtos.*;
import com.stockguard.security.AuthUser;
import com.stockguard.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
        return userService.register(req);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return userService.login(req);
    }

    @GetMapping("/me")
    public UserDto me(@AuthenticationPrincipal AuthUser user) {
        return UserDto.from(userService.getUser(user.id()));
    }

    @PutMapping("/settings")
    public UserDto updateSettings(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody SettingsRequest req) {
        return userService.updateSettings(user.id(), req);
    }
}
