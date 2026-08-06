/**
 * Builds an outbound list-page URL to hand off as `returnTo` — pathname is
 * always a trusted literal supplied by the caller, and values are
 * URLSearchParams-encoded, so this needs no safety validation (unlike
 * resolving an *inbound* returnTo, see resolveSafeReturnTo).
 */
export function buildReturnToPath(
  pathname: string,
  params: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function appendReturnTo(path: string, returnTo: string): string {
  return `${path}?returnTo=${encodeURIComponent(returnTo)}`;
}
