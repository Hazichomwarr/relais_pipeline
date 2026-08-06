const DEFAULT_CALLBACK_URL = "/dashboard";

/**
 * True for a same-origin relative path only — rejects absolute URLs
 * (https://...), protocol-relative URLs (//...), and non-path schemes
 * (javascript:...). Shared by every "safely resolve a redirect target"
 * helper in this file so the check is defined exactly once.
 */
export function isSafeInternalPath(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  );
}

/**
 * The only place that decides where a successful, callback-less login goes.
 * `/dashboard` then performs the actual role-aware redirect, so this helper
 * must never resolve to a role-specific route.
 */
export function resolveSafeCallbackUrl(
  value: string | null | undefined,
): string {
  return isSafeInternalPath(value) ? value : DEFAULT_CALLBACK_URL;
}

/**
 * Same safety check as resolveSafeCallbackUrl, but for callers (like
 * prospect detail "returnTo") that need their own fallback instead of the
 * login flow's role-neutral /dashboard default.
 */
export function resolveSafeReturnTo(
  value: string | null | undefined,
  fallback: string,
): string {
  return isSafeInternalPath(value) ? value : fallback;
}
