package com.dinomutation.common;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Every error leaves the API as an RFC 9457 ProblemDetail with a `code` the game understands. */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(ApiException.class)
	ResponseEntity<ProblemDetail> api(ApiException e) {
		return problem(e.code(), e.getMessage(), null);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ProblemDetail> invalid(MethodArgumentNotValidException e) {
		List<Map<String, String>> errors = e.getBindingResult().getFieldErrors().stream()
				.map(f -> Map.of("field", f.getField(), "message", Objects.requireNonNullElse(f.getDefaultMessage(), "inválido")))
				.toList();
		return problem(ErrorCode.VALIDATION_ERROR, "Dados inválidos.", errors);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	ResponseEntity<ProblemDetail> unreadable(HttpMessageNotReadableException e) {
		return problem(ErrorCode.VALIDATION_ERROR, "Corpo da requisição inválido.", null);
	}

	@ExceptionHandler({ HandlerMethodValidationException.class, MethodArgumentTypeMismatchException.class })
	ResponseEntity<ProblemDetail> invalidParameters(Exception e) {
		return problem(ErrorCode.VALIDATION_ERROR, "Parâmetros inválidos.", null);
	}

	@ExceptionHandler({ ObjectOptimisticLockingFailureException.class, DataIntegrityViolationException.class })
	ResponseEntity<ProblemDetail> conflict(Exception e) {
		return problem(ErrorCode.CONFLICT, "Conflito ao salvar; tente de novo.", null);
	}

	private static ResponseEntity<ProblemDetail> problem(ErrorCode code, String detail, Object errors) {
		ProblemDetail body = ProblemDetail.forStatusAndDetail(code.status(), detail);
		body.setTitle(code.name());
		body.setProperty("code", code.name());
		if (errors != null) {
			body.setProperty("errors", errors);
		}
		return ResponseEntity.status(code.status()).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(body);
	}
}
