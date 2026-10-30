package com.stockguard.exception;

import org.springframework.http.HttpStatus;

/** Business error with a message that is safe to show to the shop owner. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    public HttpStatus getStatus() {
        return status;
    }
}
