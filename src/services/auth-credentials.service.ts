import "server-only";

import bcrypt from "bcrypt";
import type { UserRole } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import {
  authenticateCore,
  changeOwnPasswordCore,
} from "@/src/services/auth-credentials.service-core";
import { createUserWithCreationHistory } from "@/src/services/user-creation-history.service";

const SALT_ROUNDS = 12;

export async function authenticateUser(email: string, password: string) {
  return authenticateCore(email, password, {
    findUserByEmail: (validatedEmail) =>
      prisma.user.findFirst({
        where: { email: validatedEmail },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          active: true,
          passwordHash: true,
        },
      }),
    compare: (plain, hash) => bcrypt.compare(plain, hash),
  });
}

export type CreateUserWithPasswordInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  password: string;
};

/**
 * Admin-only workflow: no UI wires into this yet (Ticket 13D scope).
 * It shares the Ticket 25C transaction boundary with the current user form,
 * so enabling this path later cannot create an employee without history.
 */
export async function createUserWithPassword(
  input: CreateUserWithPasswordInput,
  actorUserId: string,
) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  return createUserWithCreationHistory(
    {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      role: input.role,
      passwordHash,
    },
    actorUserId,
  );
}

/**
 * Admin-only workflow: no UI wires into this yet (Ticket 13D scope).
 */
export async function changePassword(userId: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: { id: true },
  });
}

/**
 * Self-service password change (Ticket 13C.4): requires proof of the
 * current password, unlike changePassword() above which admins use to
 * force-set a password without knowing the old one.
 */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  return changeOwnPasswordCore(currentPassword, newPassword, {
    findPasswordHash: async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      return user?.passwordHash ?? null;
    },
    compare: (plain, hash) => bcrypt.compare(plain, hash),
    updatePassword: async (updatedPassword) => {
      await changePassword(userId, updatedPassword);
    },
  });
}
