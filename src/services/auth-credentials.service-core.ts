import type { UserRole } from "@prisma/client";

export type AuthenticatedIdentity = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

export type CredentialUserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  active: boolean;
  passwordHash: string | null;
};

export type AuthenticateDependencies = {
  findUserByEmail: (email: string) => Promise<CredentialUserRecord | null>;
  compare: (password: string, passwordHash: string) => Promise<boolean>;
};

/**
 * Returns null for every failure case (unknown email, inactive account,
 * no password set, wrong password) so a caller can never distinguish
 * "account doesn't exist" from "wrong password" — prevents user enumeration.
 */
export async function authenticateCore(
  email: string,
  password: string,
  dependencies: AuthenticateDependencies,
): Promise<AuthenticatedIdentity | null> {
  const user = await dependencies.findUserByEmail(email);

  if (!user || !user.active || !user.passwordHash) {
    return null;
  }

  const passwordMatches = await dependencies.compare(
    password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}
