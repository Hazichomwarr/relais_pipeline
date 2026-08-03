import type { UserRole } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

export type AuthorizationErrorCode = "UNAUTHENTICATED" | "ACCESS_DENIED";

export class AuthorizationError extends Error {
  constructor(
    public readonly code: AuthorizationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type SessionLike = { user?: AuthenticatedUser | null } | null;

export function requireAuthenticatedUserCore(
  session: SessionLike,
): AuthenticatedUser {
  if (!session?.user) {
    throw new AuthorizationError(
      "UNAUTHENTICATED",
      "Vous devez être connecté pour accéder à cette page.",
    );
  }

  return session.user;
}

export function requireRoleCore(
  session: SessionLike,
  roles: UserRole[],
): AuthenticatedUser {
  const user = requireAuthenticatedUserCore(session);

  if (!roles.includes(user.role)) {
    throw new AuthorizationError(
      "ACCESS_DENIED",
      "Vous n’avez pas les droits nécessaires pour accéder à cette page.",
    );
  }

  return user;
}

/**
 * A user may change their own password; ADMIN/MANAGER may change anyone's.
 * Takes an already-authenticated user (no session fetch) so callers that
 * already ran requireAuthenticatedUser() don't pay for a second lookup.
 */
export function assertCanChangePasswordCore(
  user: AuthenticatedUser,
  targetUserId: string,
): void {
  const isSelf = user.id === targetUserId;
  const isElevated = user.role === "ADMIN" || user.role === "MANAGER";

  if (!isSelf && !isElevated) {
    throw new AuthorizationError(
      "ACCESS_DENIED",
      "Vous n’avez pas le droit de modifier le mot de passe de cet utilisateur.",
    );
  }
}
