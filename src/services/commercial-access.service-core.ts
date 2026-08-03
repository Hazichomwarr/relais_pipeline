import type { UserRole } from "@prisma/client";

import { commercialDashboardSchema } from "@/src/lib/validations/commercial-dashboard.schema";

export type CommercialAccessErrorCode =
  | "COMMERCIAL_NOT_FOUND"
  | "COMMERCIAL_INACTIVE"
  | "USER_NOT_COMMERCIAL";

export class CommercialAccessError extends Error {
  constructor(
    public readonly code: CommercialAccessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommercialAccessError";
  }
}

export type CommercialIdentity = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  active: boolean;
};

export async function assertCommercialAccessCore(
  userId: string,
  findUser: (validatedUserId: string) => Promise<CommercialIdentity | null>,
) {
  const { userId: validatedUserId } = commercialDashboardSchema.parse({
    userId,
  });
  const user = await findUser(validatedUserId);

  if (!user) {
    throw new CommercialAccessError(
      "COMMERCIAL_NOT_FOUND",
      "Ce commercial n’existe pas.",
    );
  }
  if (!user.active) {
    throw new CommercialAccessError(
      "COMMERCIAL_INACTIVE",
      "Ce commercial est désactivé.",
    );
  }
  if (user.role !== "COMMERCIAL") {
    throw new CommercialAccessError(
      "USER_NOT_COMMERCIAL",
      "Cet utilisateur n’a pas le rôle commercial.",
    );
  }

  return user;
}
