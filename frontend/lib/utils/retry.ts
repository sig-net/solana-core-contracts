export interface RetryOptions {
  maxAttempts?: number;
  backoffMs?: (attempt: number) => number;
  shouldRetry?: (error: unknown) => boolean;
  signal?: AbortSignal;
}

/**
 * Retry an asynchronous operation with quadratic backoff by default.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const backoffMs =
    options.backoffMs ?? ((attempt: number) => 500 * attempt * attempt);
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      throw new Error('Operation aborted');
    }
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts || !shouldRetry(e)) {
        break;
      }
      const delay = backoffMs(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const message = (lastError as Error | undefined)?.message || 'unknown error';
  throw new Error(`Retry failed after ${maxAttempts} attempts: ${message}`);
}
