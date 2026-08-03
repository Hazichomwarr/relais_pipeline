import "dotenv/config";

import bcrypt from "bcrypt";

import { prisma } from "@/src/lib/prisma";

const SALT_ROUNDS = 12;

async function main() {
  const email = process.env.USER_EMAIL;
  const password = process.env.USER_TEMP_PASSWORD;

  if (!email || !password) {
    throw new Error("USER_EMAIL and USER_TEMP_PASSWORD are required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      active: true,
    },
  });

  if (!user) {
    throw new Error(`No user found with email ${normalizedEmail}.`);
  }

  if (!user.active) {
    throw new Error("This user is inactive.");
  }

  if (user.role !== "COMMERCIAL") {
    throw new Error("This script is only for COMMERCIAL users.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      passwordHash,
    },
  });

  console.log(`Temporary password set for ${user.firstName} ${user.lastName}.`);
}

main()
  .catch((error) => {
    console.error("Unable to set password:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
