package com.dinomutation.run;

/** `created` = false when the same run id had already been recorded (the stored rewards are returned). */
public record RunOutcome(RunResponse response, boolean created) {}
