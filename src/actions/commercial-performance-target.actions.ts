"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import {
  createCommercialPerformanceTargetSchema,
  deleteCommercialPerformanceTargetSchema,
  updateCommercialPerformanceTargetSchema,
} from "@/src/lib/validations/commercial-performance-target.schema";
import {
  createCommercialPerformanceTarget,
  deleteCommercialPerformanceTarget,
  updateCommercialPerformanceTarget,
} from "@/src/services/commercial-performance-target.service";
import { requireCommercialPerformanceTargetManagementAccess } from "@/src/services/authorization.service";

export type CommercialPerformanceTargetActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * The authorization gate here (ADMIN/MANAGER) is redundant with the
 * service-core's own canManageCommercialPerformanceTargets check by
 * design — Ticket 25H.2A §9/§44: never trust a single layer for "an
 * employee could set their own target."
 */
export async function createCommercialPerformanceTargetAction(
  values: unknown,
): Promise<CommercialPerformanceTargetActionResult> {
  const authorization = await authorizeAction(() =>
    requireCommercialPerformanceTargetManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = createCommercialPerformanceTargetSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createCommercialPerformanceTarget(
    authorization.user,
    parsed.data,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/admin/users");

  return { success: true };
}

export async function updateCommercialPerformanceTargetAction(
  values: unknown,
): Promise<CommercialPerformanceTargetActionResult> {
  const authorization = await authorizeAction(() =>
    requireCommercialPerformanceTargetManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = updateCommercialPerformanceTargetSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await updateCommercialPerformanceTarget(
    authorization.user,
    parsed.data.targetId,
    parsed.data.targetWins,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/admin/users");

  return { success: true };
}

export async function deleteCommercialPerformanceTargetAction(
  values: unknown,
): Promise<CommercialPerformanceTargetActionResult> {
  const authorization = await authorizeAction(() =>
    requireCommercialPerformanceTargetManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = deleteCommercialPerformanceTargetSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await deleteCommercialPerformanceTarget(
    authorization.user,
    parsed.data.targetId,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/admin/users");

  return { success: true };
}
