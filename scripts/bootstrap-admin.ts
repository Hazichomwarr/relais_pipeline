import "dotenv/config";

import bcrypt from "bcrypt";

import { prisma } from "@/src/lib/prisma";

const SALT_ROUNDS = 12;

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new Error(`A user already exists with email ${normalizedEmail}.`);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Foundational exception to Ticket 25C's authenticated creation path: this
  // script creates the very first administrator, so no authenticated actor
  // exists yet. Never fabricate a self-created lifecycle row. All subsequent
  // operational user creation goes through createUserWithCreationHistory().
  const admin = await prisma.user.create({
    data: {
      firstName: "Hamza",
      lastName: "Mare",
      email: normalizedEmail,
      phone: null,
      role: "ADMIN",
      active: true,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log("Admin created successfully:", admin);
}

main()
  .catch((error) => {
    console.error("Unable to bootstrap admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
