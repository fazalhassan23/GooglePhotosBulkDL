import { setTimeout as delay } from "node:timers/promises";
export async function request(
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      const response = await fetch(url, {
        ...init,
        redirect: "error",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
          : AbortSignal.timeout(60000),
      });
      if (response.ok) return response;
      if (
        ![408, 429, 500, 502, 503, 504].includes(response.status) ||
        attempt === 4
      )
        throw new PermanentError(
          response.status === 401
            ? "Authentication expired. Sign in again."
            : response.status === 403
              ? "Access denied. Check consent and API configuration."
              : `Service returned HTTP ${response.status}`,
        );
      const retry = response.headers.get("retry-after");
      await response.body?.cancel();
      const retryMs = retry
        ? /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : Date.parse(retry) - Date.now()
        : 0;
      await delay(
        Math.max(
          0,
          retryMs,
          Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 500,
        ),
        undefined,
        { signal },
      );
    } catch (e) {
      if (e instanceof PermanentError || signal?.aborted || attempt === 4)
        throw e;
      await delay(1000 * 2 ** attempt, undefined, { signal });
    }
  }
}
class PermanentError extends Error {}
