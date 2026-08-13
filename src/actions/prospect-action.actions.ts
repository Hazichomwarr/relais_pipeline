"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import {
  cancelProspectActionSchema,
  completeProspectActionSchema,
  createProspectActionSchema,
} from "@/src/lib/validations/prospect-action.schema";
import {
  cancelProspectAction,
  completeProspectAction,
  createProspectAction,
} from "@/src/services/prospect-action.service";
import { requireAuthenticatedUser } from "@/src/services/authorization.service";

export type CreateProspectActionActionResult =
  | { success: true; actionId: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export type CompleteProspectActionActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export type CancelProspectActionActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * Role-neutral at the authentication layer, like createProspectAction in
 * prospect.actions.ts (Ticket 15H.1) — ownership scoping for who may
 * create on which prospect happens inside the service, keyed off
 * authorization.user.role, never off client input.
 */
export async function createProspectActionAction(
  values: unknown,
): Promise<CreateProspectActionActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = createProspectActionSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de l’action sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createProspectAction(authorization.user, parsed.data);

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidateProspectActionPaths(parsed.data.prospectId);

  return { success: true, actionId: result.actionId };
}

export async function completeProspectActionAction(
  values: unknown,
): Promise<CompleteProspectActionActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = completeProspectActionSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await completeProspectAction(
    authorization.user,
    parsed.data.actionId,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidateProspectActionPaths(result.prospectId);

  return { success: true };
}

export async function cancelProspectActionAction(
  values: unknown,
): Promise<CancelProspectActionActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = cancelProspectActionSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await cancelProspectAction(
    authorization.user,
    parsed.data.actionId,
    parsed.data.cancellationReason,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidateProspectActionPaths(result.prospectId);

  return { success: true };
}

function revalidateProspectActionPaths(prospectId: string): void {
  revalidatePath(`/admin/prospects/${prospectId}`);
  revalidatePath(`/dashboard/commercial/prospects/${prospectId}`);
}
