/**
 * Security validation utilities
 *
 * Provides input validation and sanitization to protect against common security vulnerabilities.
 */

import { SECURITY_PATTERNS } from '../constants';

/**
 * Validation result with details
 */
export interface ValidationResult {
	isValid: boolean;
	error?: string;
	sanitized?: string;
}

/**
 * Validates and sanitizes experiment names to prevent path traversal attacks
 *
 * @param experimentName - The experiment name to validate
 * @returns Validation result with sanitized name
 *
 * @example
 * ```typescript
 * const result = validateExperimentName('../../../etc/passwd');
 * // Returns: { isValid: false, error: 'Experiment name contains path traversal patterns...' }
 * ```
 */
export function validateExperimentName(experimentName: string): ValidationResult {
	// Check for empty name
	if (!experimentName || experimentName.trim().length === 0) {
		return {
			isValid: false,
			error: 'Experiment name cannot be empty',
		};
	}

	// Check length to prevent DoS
	if (experimentName.length > SECURITY_PATTERNS.MAX_EXPERIMENT_NAME_LENGTH) {
		return {
			isValid: false,
			error: `Experiment name too long. Maximum ${SECURITY_PATTERNS.MAX_EXPERIMENT_NAME_LENGTH} characters allowed`,
		};
	}

	// Check for path traversal patterns
	if (SECURITY_PATTERNS.PATH_TRAVERSAL.test(experimentName)) {
		return {
			isValid: false,
			error:
				'Experiment name contains path traversal patterns (e.g., "..", "../"). ' +
				'Please use only alphanumeric characters, spaces, hyphens, underscores, and forward slashes.',
		};
	}

	// Check for safe characters only
	if (!SECURITY_PATTERNS.SAFE_EXPERIMENT_NAME.test(experimentName)) {
		return {
			isValid: false,
			error:
				'Experiment name contains invalid characters. ' +
				'Allowed characters: letters, numbers, spaces, hyphens (-), underscores (_), and forward slashes (/).',
		};
	}

	// Sanitize by trimming and normalizing slashes
	const sanitized = experimentName
		.trim()
		.replace(/\/+/g, '/') // Replace multiple slashes with single slash
		.replace(/^\/|\/$/g, ''); // Remove leading/trailing slashes

	return {
		isValid: true,
		sanitized,
	};
}

/**
 * Validates Databricks host URL to prevent SSRF attacks
 *
 * @param host - The host URL to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateDatabricksHost('http://localhost:8080');
 * // Returns: { isValid: false, error: 'Host URL is not a valid Databricks workspace...' }
 * ```
 */
export function validateDatabricksHost(host: string): ValidationResult {
	// Check for empty host
	if (!host || host.trim().length === 0) {
		return {
			isValid: false,
			error: 'Host URL cannot be empty',
		};
	}

	// Check length to prevent DoS
	if (host.length > SECURITY_PATTERNS.MAX_HOST_LENGTH) {
		return {
			isValid: false,
			error: `Host URL too long. Maximum ${SECURITY_PATTERNS.MAX_HOST_LENGTH} characters allowed`,
		};
	}

	const trimmedHost = host.trim();

	// Check if it's a valid Databricks host pattern
	if (!SECURITY_PATTERNS.VALID_DATABRICKS_HOST.test(trimmedHost)) {
		return {
			isValid: false,
			error:
				'Host URL is not a valid Databricks workspace URL. ' +
				'Expected format: https://adb-xxxxx.xx.azuredatabricks.net or ' +
				'https://xxxxx.cloud.databricks.com',
		};
	}

	// Additional check: extract hostname and verify it's not a private IP
	try {
		const url = new URL(trimmedHost);
		const hostname = url.hostname;

		// Check if hostname is a private IP address
		if (SECURITY_PATTERNS.PRIVATE_IP.test(hostname)) {
			// Allow localhost for testing purposes, but warn
			if (hostname === 'localhost' || hostname === '127.0.0.1') {
				// This is allowed for local development
				return {
					isValid: true,
					sanitized: trimmedHost,
				};
			}

			return {
				isValid: false,
				error:
					'Host URL resolves to a private IP address. ' +
					'This may indicate an SSRF attack attempt.',
			};
		}
	} catch (error: unknown) {
		return {
			isValid: false,
			error: 'Host URL is not a valid URL',
		};
	}

	return {
		isValid: true,
		sanitized: trimmedHost,
	};
}

/**
 * Sanitizes experiment ID for use in URL construction
 *
 * @param experimentId - The experiment ID to sanitize
 * @returns Sanitized experiment ID or null if invalid
 *
 * @example
 * ```typescript
 * const id = sanitizeExperimentId('12345');
 * // Returns: '12345'
 *
 * const invalid = sanitizeExperimentId('12345; DROP TABLE experiments;--');
 * // Returns: null
 * ```
 */
export function sanitizeExperimentId(experimentId: string): string | null {
	// Experiment IDs must be numeric only
	if (!/^\d+$/.test(experimentId)) {
		return null;
	}

	// Check for reasonable length (Databricks experiment IDs are typically 13-16 digits)
	if (experimentId.length > 20) {
		return null;
	}

	return experimentId;
}

/**
 * Validates API response structure to prevent code execution from malicious responses
 *
 * @param response - The API response to validate
 * @param expectedFields - Array of required field names
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateApiResponse(
 *   response,
 *   ['experiment_id', 'name']
 * );
 * ```
 */
export function validateApiResponse(
	response: unknown,
	expectedFields: string[],
): ValidationResult {
	// Must be an object
	if (!response || typeof response !== 'object') {
		return {
			isValid: false,
			error: 'API response is not an object',
		};
	}

	// Check for expected fields
	for (const field of expectedFields) {
		if (!(field in response)) {
			return {
				isValid: false,
				error: `API response missing required field: ${field}`,
			};
		}
	}

	return {
		isValid: true,
	};
}

/**
 * Rate limiter for API requests
 */
export class RateLimiter {
	private requests: number[] = [];
	private readonly maxRequests: number;
	private readonly windowMs: number;

	/**
	 * Creates a new rate limiter
	 *
	 * @param maxRequests - Maximum requests allowed in the time window
	 * @param windowMs - Time window in milliseconds
	 */
	constructor(maxRequests: number = 100, windowMs: number = 60000) {
		this.maxRequests = maxRequests;
		this.windowMs = windowMs;
	}

	/**
	 * Checks if a request is allowed under rate limit
	 *
	 * @returns True if request is allowed, false if rate limited
	 */
	public isAllowed(): boolean {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		// Remove requests outside the current window
		this.requests = this.requests.filter((timestamp) => timestamp > windowStart);

		// Check if we're under the limit
		if (this.requests.length >= this.maxRequests) {
			return false;
		}

		// Record this request
		this.requests.push(now);
		return true;
	}

	/**
	 * Gets the number of requests remaining in the current window
	 */
	public getRemaining(): number {
		const now = Date.now();
		const windowStart = now - this.windowMs;
		const recentRequests = this.requests.filter((timestamp) => timestamp > windowStart);
		return Math.max(0, this.maxRequests - recentRequests.length);
	}

	/**
	 * Resets the rate limiter
	 */
	public reset(): void {
		this.requests = [];
	}
}
