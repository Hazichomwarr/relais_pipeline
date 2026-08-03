import "server-only";

import bcrypt from "bcrypt";
import type { UserRole } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { authenticateCore } from "@/src/services/auth-credentials.service-core";

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
 * Kept separate from user.service.ts's createUser() so the existing,
 * already-tested admin user creation flow stays untouched.
 */
export async function createUserWithPassword(
  input: CreateUserWithPasswordInput,
) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  return prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      role: input.role,
      passwordHash,
    },
    select: { id: true },
  });
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
