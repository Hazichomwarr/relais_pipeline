import "server-only";

import { prisma } from "@/src/lib/prisma";
import { assertActiveAccountAccessCore } from "@/src/services/account-access.service-core";

export function assertActiveAccountAccess(userId: string) {
  return assertActiveAccountAccessCore(userId, (validatedUserId) =>
    prisma.user.findUnique({
      where: { id: validatedUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
      },
    }),
  );
}
