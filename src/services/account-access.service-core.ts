import type { UserRole } from "@prisma/client";

export type AccountAccessErrorCode = "ACCOUNT_NOT_FOUND" | "ACCOUNT_INACTIVE";

export class AccountAccessError extends Error {
  constructor(
    public readonly code: AccountAccessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AccountAccessError";
  }
}

export type AccountIdentity = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  active: boolean;
};

/**
 * Ticket 25F: the role-neutral counterpart to assertCommercialAccessCore
 * (commercial-access.service-core.ts) — re-verifies the authenticated
 * actor is still a real, active account against the database (not just
 * the JWT-cached role/active flag), without restricting to any
 * particular role. Self-service password change and the shared /profile
 * page are authenticated-user capabilities, not role-gated ones, so this
 * deliberately omits the role check that makes the Commercial version
 * Commercial-only.
 */
export async function assertActiveAccountAccessCore(
  userId: string,
  findUser: (userId: string) => Promise<AccountIdentity | null>,
): Promise<AccountIdentity> {
  const user = await findUser(userId);

  if (!user) {
    throw new AccountAccessError(
      "ACCOUNT_NOT_FOUND",
      "Ce compte n’existe pas.",
    );
  }

  if (!user.active) {
    throw new AccountAccessError("ACCOUNT_INACTIVE", "Ce compte est désactivé.");
  }

  return user;
}
