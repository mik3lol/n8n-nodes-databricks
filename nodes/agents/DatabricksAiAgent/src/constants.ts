/**
 * Centralized constants for the AI Agent with MLflow node
 *
 * This file contains all magic numbers, patterns, and configuration values
 * used throughout the codebase to improve maintainability and consistency.
 */

/**
 * MLflow and API related constants
 */
export const MLFLOW_CONSTANTS = {
    // Timeouts (in milliseconds)
    API_REQUEST_TIMEOUT_MS: 10000,           // 10 seconds for HTTP requests
    MLFLOW_INIT_TIMEOUT_MS: 30000,           // 30 seconds for MLflow initialization
    SPAN_CLEANUP_DELAY_MS: 100,              // Delay before cleanup to allow pending operations

    // Limits
    MAX_BATCH_SIZE: 1000,                     // Maximum items per batch
    MAX_DELAY_BETWEEN_BATCHES_MS: 300000,    // 5 minutes maximum delay between batches
    MAX_INPUT_LENGTH: 100000,                 // 100k characters - warn if input exceeds
    MAX_OUTPUT_SIZE: 1000000,                 // 1MB - warn if output exceeds
    MAX_TOOL_NAME_LENGTH: 64,                 // Maximum tool name length
    MAX_TOOL_DESCRIPTION_LENGTH: 1000,        // Warn if description exceeds
    MIN_TOOL_DESCRIPTION_LENGTH: 10,          // Warn if description is too short
    MIN_DATABRICKS_TOKEN_LENGTH: 20,          // Databricks tokens are typically 40+ chars

    // Patterns
    EXPERIMENT_ID_PATTERN: /^\d+$/,           // Experiment IDs must be numeric
    TOOL_NAME_PATTERN: /^[a-zA-Z0-9_-]+$/,   // Valid tool name characters

    // CallbackHandler memory management
    MAX_RUN_MAP_SIZE: 1000,                   // Maximum spans in runMap before cleanup
    RUN_MAP_CHECK_THRESHOLD: 500,             // Start checking for old spans at this size
    RUN_MAP_CLEANUP_INTERVAL_MS: 60000,       // Clean every minute
    MAX_SPAN_AGE_MS: 300000,                  // 5 minutes - spans older than this are closed

    // Retry configuration
    DEFAULT_MAX_RETRIES: 3,                   // Number of retry attempts for network requests
    DEFAULT_RETRY_BASE_DELAY_MS: 1000,        // Base delay for exponential backoff
    MAX_RETRY_DELAY_MS: 10000,                // Cap for exponential backoff

    // Attributes sanitization
    MAX_ATTRIBUTE_DEPTH: 10,                  // Max nesting depth for span attributes
    MAX_ARRAY_SIZE_IN_ATTRIBUTES: 100,        // Truncate arrays longer than this
    MAX_OBJECT_KEYS_IN_ATTRIBUTES: 50,        // Truncate objects with more keys than this
} as const;

/**
 * Databricks domain patterns for validation
 */
export const DATABRICKS_PATTERNS = {
    AZURE: /\.azuredatabricks\.net$/,
    AWS: /\.cloud\.databricks\.com$/,
    GCP: /\.gcp\.databricks\.com$/,
} as const;

/**
 * Error messages for consistent user feedback
 */
export const ERROR_MESSAGES = {
    // Credentials
    MISSING_CREDENTIALS: 'Databricks credentials are required when MLflow logging is enabled',
    EMPTY_HOST: 'Databricks host is missing or empty in credentials. Please configure valid Databricks credentials.',
    EMPTY_TOKEN: 'Databricks token is missing or empty in credentials. Please configure valid Databricks credentials.',
    INVALID_HOST_URL: (host: string, reason: string) =>
        `Invalid Databricks host URL: "${host}". ${reason}. Expected format: https://adb-xxxxx.xx.azuredatabricks.net`,
    SHORT_TOKEN_WARNING: (length: number) =>
        `Databricks token seems unusually short (${length} characters). ` +
        `Databricks personal access tokens are typically 40+ characters. ` +
        `Please verify your token is correct.`,

    // Experiment
    EMPTY_EXPERIMENT_NAME: 'Experiment name cannot be empty. Please provide a valid experiment name.',
    INVALID_EXPERIMENT_ID: (id: string) =>
        `Invalid experiment ID format: "${id}". Expected numeric ID (e.g., 1427538817675103)`,
    INVALID_EXPERIMENT_SELECTION: 'Invalid experiment selection. Please select an experiment from the list or enter a custom name.',
    INVALID_EXPERIMENT_ID_FROM_LIST: (id: string) =>
        `Invalid experiment ID from list: "${id}". Expected numeric ID. ` +
        `This may indicate a problem with the experiment list. Try refreshing or using a custom name.`,
    EXPERIMENT_NOT_FOUND: (path: string) =>
        `Experiment "${path}" not found and "Create If Not Exists" is disabled`,
    EXPERIMENT_CREATE_FAILED: (path: string, reason: string) =>
        `Failed to create experiment "${path}": ${reason}`,

    // Input validation
    EMPTY_INPUT: 'The "text" parameter is empty.',
    WHITESPACE_INPUT: 'The "text" parameter contains only whitespace. Please provide a valid prompt.',
    LONG_INPUT_WARNING: (length: number, max: number) =>
        `Input is very long (${length} characters). ` +
        `This may cause performance issues or token limit errors. Maximum recommended: ${max} characters.`,

    // Batch processing
    EXECUTION_CANCELLED: (batch: number, total: number) =>
        `Execution was cancelled by user at batch ${batch} of ${total}`,

    // Network
    HTTP_REQUEST_TIMEOUT: 'HTTP request timeout. Please check if Databricks host is reachable.',
    MAX_RETRIES_EXCEEDED: (retries: number, lastError: string) =>
        `HTTP request failed after ${retries} attempts. Last error: ${lastError}`,

    // MLflow
    MLFLOW_INIT_FAILED: (reason: string) =>
        `Failed to initialize MLflow: ${reason}. Please check your configuration.`,
    MLFLOW_INIT_TIMEOUT: 'MLflow client initialization timeout',

    // Model
    MODEL_NOT_CONNECTED: 'Please connect a model to the Chat Model input',
    FALLBACK_MODEL_NOT_CONNECTED: 'Please connect a model to the Fallback Model input or disable the fallback option',

    // Security
    HTTP_INSECURE_WARNING: (url: string) =>
        `Databricks host is using HTTP instead of HTTPS: ${url}. ` +
        `This is insecure and may not work with Databricks. ` +
        `Consider using HTTPS instead.`,
} as const;

/**
 * HTTP status codes that should not be retried
 */
export const NON_RETRYABLE_STATUS_CODES = [
    400, // Bad Request
    401, // Unauthorized
    403, // Forbidden
    404, // Not Found
    405, // Method Not Allowed
    422, // Unprocessable Entity
] as const;

/**
 * HTTP status codes that should be retried
 */
export const RETRYABLE_STATUS_CODES = [
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
] as const;

/**
 * Log levels for different scenarios
 */
export const LOG_LEVELS = {
    BATCH_SIZE_ADJUSTED: 'warn',
    DELAY_ADJUSTED: 'warn',
    TOKEN_SHORT: 'warn',
    HTTP_INSECURE: 'warn',
    USER_NOT_FOUND: 'warn',
    RETRY_ATTEMPT: 'debug',
    CLEANUP: 'debug',
    EXECUTION_START: 'info',
    EXECUTION_COMPLETE: 'info',
    MLFLOW_INITIALIZED: 'info',
} as const;

/**
 * Security validation patterns
 */
export const SECURITY_PATTERNS = {
    // Path traversal patterns to detect
    PATH_TRAVERSAL: /\.\.|\/\.\.|\.\.\/|%2e%2e|\.\.%2f|%2e%2e%2f/i,

    // Valid Databricks workspace URL pattern
    VALID_DATABRICKS_HOST: /^https:\/\/([a-zA-Z0-9.-]+\.(azuredatabricks\.net|cloud\.databricks\.com|gcp\.databricks\.com)|localhost(:[0-9]+)?)$/,

    // Private/localhost IP ranges (SSRF protection)
    PRIVATE_IP: /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1|fc00:|fe80:)/,

    // Experiment name validation (alphanumeric, spaces, hyphens, underscores only)
    SAFE_EXPERIMENT_NAME: /^[a-zA-Z0-9\s\-_\/]+$/,

    // Maximum safe lengths to prevent DoS
    MAX_EXPERIMENT_NAME_LENGTH: 200,
    MAX_HOST_LENGTH: 500,
} as const;

/**
 * Token masking patterns for secure logging
 */
export const TOKEN_PATTERNS = {
    // Databricks tokens (dapi...)
    DATABRICKS_TOKEN: /dapi[a-zA-Z0-9]{20,}/g,

    // Generic long alphanumeric tokens (40+ chars)
    GENERIC_LONG_TOKEN: /\b[a-zA-Z0-9]{40,}\b/g,

    // Bearer tokens in headers
    BEARER_TOKEN: /Bearer\s+[a-zA-Z0-9._-]+/gi,

    // Replacement value
    MASK: '****',
} as const;
