/**
 * Network retry utilities with exponential backoff
 *
 * Provides robust retry logic for HTTP requests to handle transient failures.
 */

import type { IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
    MLFLOW_CONSTANTS,
    ERROR_MESSAGES,
    NON_RETRYABLE_STATUS_CODES,
    RETRYABLE_STATUS_CODES,
    TOKEN_PATTERNS,
} from '../constants';

/**
 * Options for HTTP request retry logic
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Base delay in milliseconds for exponential backoff (default: 1000) */
    baseDelay?: number;
    /** Maximum delay between retries in milliseconds (default: 10000) */
    maxDelay?: number;
    /** Whether to add random jitter to delays (default: true) */
    useJitter?: boolean;
}

/**
 * Error information for retry decisions
 */
interface RetryableError {
    isRetryable: boolean;
    statusCode?: number;
    message: string;
}

/**
 * Analyzes an error to determine if it should be retried
 *
 * @param error - The error to analyze
 * @returns Information about whether the error is retryable
 */
function analyzeError(error: unknown): RetryableError {
    const errorMsg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Extract status code if available
    let statusCode: number | undefined;
    if (typeof error === 'object' && error !== null) {
        if ('statusCode' in error) {
            statusCode = error.statusCode as number;
        } else if ('status' in error) {
            statusCode = error.status as number;
        }
    }

    // Check if status code is explicitly non-retryable
    if (statusCode && NON_RETRYABLE_STATUS_CODES.includes(statusCode as any)) {
        return {
            isRetryable: false,
            statusCode,
            message: errorMsg,
        };
    }

    // Check if status code is explicitly retryable
    if (statusCode && RETRYABLE_STATUS_CODES.includes(statusCode as any)) {
        return {
            isRetryable: true,
            statusCode,
            message: errorMsg,
        };
    }

    // Check for specific error patterns that should not be retried
    const nonRetryablePatterns = [
        'unauthorized',
        'forbidden',
        'bad request',
        'not found',
        'invalid',
        'authentication',
        'permission',
    ];

    if (nonRetryablePatterns.some(pattern => errorMsg.includes(pattern))) {
        return {
            isRetryable: false,
            statusCode,
            message: errorMsg,
        };
    }

    // Check for network/timeout errors that should be retried
    const retryablePatterns = [
        'timeout',
        'etimedout',
        'econnreset',
        'econnrefused',
        'network',
        'socket hang up',
        'rate limit',
        'too many requests',
    ];

    if (retryablePatterns.some(pattern => errorMsg.includes(pattern))) {
        return {
            isRetryable: true,
            statusCode,
            message: errorMsg,
        };
    }

    // Default: treat as retryable for safety
    return {
        isRetryable: true,
        statusCode,
        message: errorMsg,
    };
}

/**
 * Calculates the delay for the next retry attempt using exponential backoff
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = options.baseDelay * Math.pow(2, attempt);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, options.maxDelay);

    // Add jitter if enabled (random value between 0 and delay)
    if (options.useJitter) {
        return Math.floor(cappedDelay * (0.5 + Math.random() * 0.5));
    }

    return cappedDelay;
}

/**
 * Executes an HTTP request with automatic retry on transient failures
 *
 * Uses exponential backoff with jitter to avoid thundering herd problems.
 * Automatically detects retryable vs non-retryable errors.
 *
 * @param ctx - The n8n execution context
 * @param requestOptions - Options to pass to httpRequest
 * @param retryOptions - Retry configuration
 * @returns Promise resolving to the HTTP response
 * @throws NodeOperationError if all retries are exhausted
 *
 * @example
 * ```typescript
 * const response = await httpRequestWithRetry(
 *   this,
 *   {
 *     method: 'GET',
 *     url: `${databricksHost}/api/2.0/mlflow/experiments/search`,
 *     headers: { Authorization: `Bearer ${token}` },
 *     json: true,
 *     timeout: 10000,
 *   },
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function httpRequestWithRetry<T = any>(
    ctx: IExecuteFunctions | ISupplyDataFunctions,
    requestOptions: any,
    retryOptions: RetryOptions = {},
): Promise<T> {
    // Merge with defaults
    const options: Required<RetryOptions> = {
        maxRetries: retryOptions.maxRetries ?? MLFLOW_CONSTANTS.DEFAULT_MAX_RETRIES,
        baseDelay: retryOptions.baseDelay ?? MLFLOW_CONSTANTS.DEFAULT_RETRY_BASE_DELAY_MS,
        maxDelay: retryOptions.maxDelay ?? MLFLOW_CONSTANTS.MAX_RETRY_DELAY_MS,
        useJitter: retryOptions.useJitter ?? true,
    };

    let lastError: Error | undefined;
    const url = requestOptions.url || requestOptions.baseURL;

    for (let attempt = 0; attempt < options.maxRetries; attempt++) {
        try {
            const response = await ctx.helpers.httpRequest(requestOptions);
            return response as T;
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Analyze if we should retry
            const errorInfo = analyzeError(error);

            // Don't retry on non-retryable errors
            if (!errorInfo.isRetryable) {
                ctx.logger.debug(
                    `Non-retryable error for ${url}: ${errorInfo.message}` +
                    (errorInfo.statusCode ? ` (status: ${errorInfo.statusCode})` : '')
                );
                throw lastError;
            }

            // Don't retry if this was the last attempt
            if (attempt === options.maxRetries - 1) {
                break;
            }

            // Calculate delay with exponential backoff
            const delay = calculateDelay(attempt, options);

            ctx.logger.debug(
                `HTTP request to ${url} failed (attempt ${attempt + 1}/${options.maxRetries}): ${errorInfo.message}` +
                (errorInfo.statusCode ? ` (status: ${errorInfo.statusCode})` : '') +
                `. Retrying in ${delay}ms...`
            );

            // Wait before next retry
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // All retries exhausted
    const errorMessage = ERROR_MESSAGES.MAX_RETRIES_EXCEEDED(
        options.maxRetries,
        lastError?.message || 'Unknown error'
    );

    throw new NodeOperationError(ctx.getNode(), errorMessage);
}

/**
 * Masks sensitive credentials for safe logging
 *
 * @param credentials - Credentials object with host and token
 * @returns Masked credentials safe for logging
 *
 * @example
 * ```typescript
 * const masked = maskCredentials({
 *   host: 'https://adb-12345.azuredatabricks.net',
 *   token: 'dapi1234567890abcdef1234567890abcdef1234'
 * });
 * // Returns: {
 * //   host: 'https://adb-12345.***',
 * //   token: 'dapi****'
 * // }
 * ```
 */
export function maskCredentials(credentials: {
    host?: string;
    token?: string;
}): {
    host: string;
    token: string;
} {
    return {
        host: credentials.host
            ? credentials.host.replace(
                /^(https?:\/\/[^.]+)(\.[^.]+\..*)$/,
                '$1.***'
            )
            : '***',
        // Only show first 4 chars, mask the rest completely for maximum security
        token: credentials.token && credentials.token.length >= 4
            ? `${credentials.token.substring(0, 4)}****`
            : '***',
    };
}

/**
 * Masks any token-like strings found in text for safe logging
 *
 * @param text - Text that may contain tokens
 * @returns Text with tokens masked
 *
 * @example
 * ```typescript
 * const safe = maskTokensInText('Token: dapi1234567890abcdef');
 * // Returns: 'Token: dapi****'
 * ```
 */
export function maskTokensInText(text: string): string {
    // Mask Databricks tokens (dapi...)
    let masked = text.replace(TOKEN_PATTERNS.DATABRICKS_TOKEN, `dapi${TOKEN_PATTERNS.MASK}`);

    // Mask generic long alphanumeric tokens (40+ chars)
    masked = masked.replace(TOKEN_PATTERNS.GENERIC_LONG_TOKEN, TOKEN_PATTERNS.MASK);

    // Mask Bearer tokens in headers
    masked = masked.replace(TOKEN_PATTERNS.BEARER_TOKEN, `Bearer ${TOKEN_PATTERNS.MASK}`);

    return masked;
}
