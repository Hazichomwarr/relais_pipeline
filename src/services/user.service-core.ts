import type { User, UserRole } from "@prisma/client";

import type {
  ValidatedUserInput,
  ValidatedUserUpdateInput,
} from "@/src/lib/validations/user.schema";

export type UserListFilters = {
  active?: boolean;
};

export type UserWriteResult =
  | { success: true; userId: string }
  | {
      success: false;
      code: "NOT_FOUND" | "CREATE_FAILED" | "UPDATE_FAILED";
      message: string;
    };

export type DeactivateUserResult =
  | { success: true; userId: string }
  | {
      success: false;
      code: "NOT_FOUND" | "DEACTIVATE_FAILED";
      message: string;
    };

export type UserServiceDependencies = {
  create: (data: ValidatedUserInput) => Promise<{ id: string }>;
  update: (
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string | null;
      phone?: string | null;
      role?: UserRole;
      active?: boolean;
    },
  ) => Promise<{ id: string }>;
  findById: (userId: string) => Promise<User | null>;
  list: (filters: UserListFilters) => Promise<User[]>;
};

export async function createUserCore(
  input: ValidatedUserInput,
  dependencies: UserServiceDependencies,
): Promise<UserWriteResult> {
  try {
    const user = await dependencies.create(input);
    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Unable to create user:", error);
    return {
      success: false,
      code: "CREATE_FAILED",
      message: "L’utilisateur n’a pas pu être créé. Veuillez réessayer.",
    };
  }
}

export async function updateUserCore(
  input: ValidatedUserUpdateInput,
  dependencies: UserServiceDependencies,
): Promise<UserWriteResult> {
  try {
    const existingUser = await dependencies.findById(input.userId);

    if (!existingUser) {
      return userNotFound();
    }

    const user = await dependencies.update(input.userId, {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      role: input.role,
      active: input.active,
    });

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Unable to update user:", error);
    return {
      success: false,
      code: "UPDATE_FAILED",
      message: "L’utilisateur n’a pas pu être modifié. Veuillez réessayer.",
    };
  }
}

export async function listUsersCore(
  filters: UserListFilters,
  dependencies: UserServiceDependencies,
) {
  const users = await dependencies.list(filters);

  return users.sort(
    (left, right) =>
      left.lastName.localeCompare(right.lastName, "fr", {
        sensitivity: "base",
      }) ||
      left.firstName.localeCompare(right.firstName, "fr", {
        sensitivity: "base",
      }),
  );
}

export async function getUserByIdCore(
  userId: string,
  dependencies: UserServiceDependencies,
) {
  return dependencies.findById(userId);
}

export async function deactivateUserCore(
  userId: string,
  dependencies: UserServiceDependencies,
): Promise<DeactivateUserResult> {
  try {
    const existingUser = await dependencies.findById(userId);

    if (!existingUser) {
      return {
        success: false,
        code: "NOT_FOUND",
        message: "Cet utilisateur n’existe plus.",
      };
    }

    const user = await dependencies.update(userId, { active: false });
    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Unable to deactivate user:", error);
    return {
      success: false,
      code: "DEACTIVATE_FAILED",
      message: "L’utilisateur n’a pas pu être désactivé. Veuillez réessayer.",
    };
  }
}

function userNotFound(): UserWriteResult {
  return {
    success: false,
    code: "NOT_FOUND",
    message: "Cet utilisateur n’existe plus.",
  };
}
