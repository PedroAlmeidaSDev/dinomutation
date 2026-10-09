package com.dinomutation.auth;

import com.dinomutation.common.AppProperties;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** The refresh-token cookie: unreadable by JavaScript and only sent to /api/auth. */
@Component
public class RefreshCookies {

	public static final String NAME = "refresh_token";
	private static final String PATH = "/api/auth";

	private final AppProperties props;

	public RefreshCookies(AppProperties props) {
		this.props = props;
	}

	public ResponseCookie issue(String value) {
		return base(value).maxAge(props.jwt().refreshTtl()).build();
	}

	public ResponseCookie clear() {
		return base("").maxAge(Duration.ZERO).build();
	}

	private ResponseCookie.ResponseCookieBuilder base(String value) {
		return ResponseCookie.from(NAME, value)
				.httpOnly(true)
				.secure(props.cookie().secure())
				.sameSite("Strict")
				.path(PATH);
	}
}
