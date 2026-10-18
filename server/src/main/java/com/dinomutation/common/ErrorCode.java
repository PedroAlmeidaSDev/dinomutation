package com.dinomutation.common;

import org.springframework.http.HttpStatus;

/** Stable error codes the game switches on (the `code` property of every ProblemDetail). */
public enum ErrorCode {
	VALIDATION_ERROR(HttpStatus.BAD_REQUEST),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
	EMAIL_TAKEN(HttpStatus.CONFLICT),
	INSUFFICIENT_FOSSILS(HttpStatus.CONFLICT),
	ITEM_MAXED(HttpStatus.CONFLICT),
	ITEM_NOT_FOUND(HttpStatus.NOT_FOUND),
	DIFFICULTY_LOCKED(HttpStatus.CONFLICT),
	ALREADY_IMPORTED(HttpStatus.CONFLICT),
	CONFLICT(HttpStatus.CONFLICT);

	private final HttpStatus status;

	ErrorCode(HttpStatus status) {
		this.status = status;
	}

	public HttpStatus status() {
		return status;
	}
}
