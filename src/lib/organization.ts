/**
 * Ticket 26B — the canonical bootstrap/current tenant. Every operational
 * user today belongs to exactly this Organization; this constant exists
 * only to centralize that transitional assumption so `where: { slug:
 * "relais" }` is never scattered across services (see
 * notes/ticket-26b-organization-membership-foundation.md). It names the
 * legacy bootstrap tenant, not a future active-tenant/tenant-switching
 * mechanism.
 */
export const RELAIS_ORGANIZATION_SLUG = "relais";
