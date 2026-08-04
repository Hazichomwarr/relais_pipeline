const DEFAULT_CALLBACK_URL = "/dashboard";

/**
 * The only place that decides where a successful, callback-less login goes.
 * `/dashboard` then performs the actual role-aware redirect, so this helper
 * must never resolve to a role-specific route.
 */
export function resolveSafeCallbackUrl(
  value: string | null | undefined,
): string {
  if (!value) {
    return DEFAULT_CALLBACK_URL;
  }

  const isSafeRelativeUrl = value.startsWith("/") && !value.startsWith("//");

  return isSafeRelativeUrl ? value : DEFAULT_CALLBACK_URL;
}
