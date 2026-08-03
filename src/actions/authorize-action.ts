import { AuthorizationError } from "@/src/services/authorization.service-core";

export type ActionAuthorization<T> =
  | { ok: true; user: T }
  | { ok: false; message: string };

/**
 * Converts a requireX() rejection into the { success: false, message }
 * shape every Server Action already returns, so authorization failures
 * never surface as raw thrown errors or Prisma/stack-trace details.
 */
export async function authorizeAction<T>(
  check: () => Promise<T>,
): Promise<ActionAuthorization<T>> {
  try {
    const user = await check();
    return { ok: true, user };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
