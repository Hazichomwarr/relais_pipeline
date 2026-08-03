import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

