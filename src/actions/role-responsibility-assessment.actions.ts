"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import {
  assessRoleResponsibilityItemSchema,
  createRoleResponsibilityAssessmentSchema,
  deleteRoleResponsibilityAssessmentSchema,
  submitRoleResponsibilityAssessmentSchema,
} from "@/src/lib/validations/role-responsibility-assessment.schema";
import {
  assessRoleResponsibilityItem,
  createRoleResponsibilityAssessment,
  deleteRoleResponsibilityAssessment,
  submitRoleResponsibilityAssessment,
} from "@/src/services/role-responsibility-assessment.service";
import { requireRoleResponsibilityAssessmentManagementAccess } from "@/src/services/authorization.service";

export type RoleResponsibilityAssessmentActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * The ADMIN/MANAGER gate here is the coarse one (§9/§44 of the ticket);
 * the finer "may this actor assess THIS employee's role" rule is
 * re-checked independently inside createRoleResponsibilityAssessmentCore
 * — never trusting this route-level gate alone, same defense-in-depth
 * pattern as 25H.2A.
 */
export async function createRoleResponsibilityAssessmentAction(
  values: unknown,
): Promise<RoleResponsibilityAssessmentActionResult> {
  const authorization = await authorizeAction(() =>
    requireRoleResponsibilityAssessmentManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = createRoleResponsibilityAssessmentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createRoleResponsibilityAssessment(
    authorization.user,
    parsed.data.employeeId,
    { year: parsed.data.year, month: parsed.data.month },
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/admin/performance-assessments");

  return { success: true };
}

export async function assessRoleResponsibilityItemAction(
  values: unknown,
): Promise<RoleResponsibilityAssessmentActionResult> {
  const authorization = await authorizeAction(() =>
    requireRoleResponsibilityAssessmentManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = assessRoleResponsibilityItemSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await assessRoleResponsibilityItem(
    authorization.user,
    parsed.data.assessmentId,
    parsed.data.itemId,
    parsed.data.level,
    parsed.data.observation ?? null,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath(`/admin/performance-assessments/${parsed.data.assessmentId}`);

  return { success: true };
}

export async function submitRoleResponsibilityAssessmentAction(
  values: unknown,
): Promise<RoleResponsibilityAssessmentActionResult> {
  const authorization = await authorizeAction(() =>
    requireRoleResponsibilityAssessmentManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = submitRoleResponsibilityAssessmentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await submitRoleResponsibilityAssessment(
    authorization.user,
    parsed.data.assessmentId,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath(`/admin/performance-assessments/${parsed.data.assessmentId}`);
  revalidatePath("/admin/performance-assessments");

  return { success: true };
}

export async function deleteRoleResponsibilityAssessmentAction(
  values: unknown,
): Promise<RoleResponsibilityAssessmentActionResult> {
  const authorization = await authorizeAction(() =>
    requireRoleResponsibilityAssessmentManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = deleteRoleResponsibilityAssessmentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await deleteRoleResponsibilityAssessment(
    authorization.user,
    parsed.data.assessmentId,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/admin/performance-assessments");

  return { success: true };
}
