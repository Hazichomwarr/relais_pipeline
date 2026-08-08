import type { User, UserRole, UserStatusActivityType } from "@prisma/client";

import type {
  ValidatedCommercialProfileUpdateInput,
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

/**
 * Passed to `update` only when `active` actually flips, so the Prisma
 * wiring layer can write the User update and the UserStatusActivity record
 * (Ticket 18A) in a single transaction. A current `active` boolean alone is
 * never trustworthy evidence of a past transition, so this descriptor is
 * the only path that produces shared-feed-eligible history.
 */
export type UserStatusTransition = {
  type: UserStatusActivityType;
  actorUserId: string;
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
    statusTransition?: UserStatusTransition,
  ) => Promise<{ id: string }>;
  findById: (userId: string) => Promise<User | null>;
  list: (filters: UserListFilters) => Promise<User[]>;
};

function resolveStatusTransition(
  wasActive: boolean,
  nextActive: boolean | undefined,
  actorUserId: string,
): UserStatusTransition | undefined {
  if (nextActive === undefined || nextActive === wasActive) {
    return undefined;
  }

  return { type: nextActive ? "ACTIVATED" : "DEACTIVATED", actorUserId };
}

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
  actorUserId: string,
  dependencies: UserServiceDependencies,
): Promise<UserWriteResult> {
  try {
    const existingUser = await dependencies.findById(input.userId);

    if (!existingUser) {
      return userNotFound();
    }

    const user = await dependencies.update(
      input.userId,
      {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        role: input.role,
        active: input.active,
      },
      resolveStatusTransition(existingUser.active, input.active, actorUserId),
    );

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

/**
 * Names exactly the three fields a commercial may change about themselves —
 * never spreads arbitrary input, so email/role/active can't leak through
 * regardless of what the caller's input object happens to contain.
 */
export async function updateOwnProfileCore(
  userId: string,
  input: ValidatedCommercialProfileUpdateInput,
  dependencies: Pick<UserServiceDependencies, "update">,
): Promise<UserWriteResult> {
  try {
    const user = await dependencies.update(userId, {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    });

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Unable to update own profile:", error);
    return {
      success: false,
      code: "UPDATE_FAILED",
      message: "Impossible de mettre à jour le profil.",
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
  actorUserId: string,
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

    const user = await dependencies.update(
      userId,
      { active: false },
      resolveStatusTransition(existingUser.active, false, actorUserId),
    );
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
