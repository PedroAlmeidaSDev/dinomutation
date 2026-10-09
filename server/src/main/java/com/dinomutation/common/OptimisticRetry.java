package com.dinomutation.common;

import java.util.function.Supplier;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;

/**
 * Runs a @Transactional service call and retries it once when another request changed the
 * same player first (@Version). A second conflict reaches the handler as 409 CONFLICT.
 */
@Component
public class OptimisticRetry {

	public <T> T once(Supplier<T> action) {
		try {
			return action.get();
		} catch (ObjectOptimisticLockingFailureException conflict) {
			return action.get();
		}
	}
}
