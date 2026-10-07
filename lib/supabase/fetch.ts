/**
 * A fetch that survives a dropped connection.
 *
 * Node reuses keep-alive sockets between requests. When the other end (or a
 * firewall in between) closes an idle socket, the next request on it dies with
 * a bare "TypeError: fetch failed" before it ever reaches Supabase. On shared
 * hosting this happens often enough to break pages at random.
 *
 * Reads are retried, because repeating them is harmless. Writes are NOT: a
 * failed POST may still have been delivered, and retrying it could create a
 * second booking or a duplicate document. Those surface as an error the user
 * can act on instead.
 */

const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [150, 400];
const TIMEOUT_MS = 15_000;

/** A transport failure (socket closed, DNS, timeout) rather than an HTTP error. */
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = (error as { cause?: { code?: string } }).cause;
  const code = cause?.code ?? "";
  return (
    error.name === "TypeError" ||
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code) ||
    code.startsWith("UND_ERR")
  );
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const retryable = RETRYABLE_METHODS.has(methodOf(input, init));
  const attempts = retryable ? MAX_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetch(input, {
        ...init,
        // Without a timeout a stalled socket hangs the page render until the
        // platform kills it.
        signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;
      if (!isNetworkError(error) || attempt === attempts - 1) break;

      console.warn(
        `[supabase] connection failed (attempt ${attempt + 1}/${attempts}), retrying:`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt] ?? 400));
    }
  }

  throw lastError;
}
