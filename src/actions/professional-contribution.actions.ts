"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import {
  assessProfessionalContributionItemSchema,
  createProfessionalContributionAssessmentSchema,
  deleteProfessionalContributionAssessmentSchema,
  submitProfessionalContributionAssessmentSchema,
} from "@/src/lib/validations/professional-contribution.schema";
import {
  assessProfessionalContributionItem,
  createProfessionalContributionAssessment,
  deleteProfessionalContributionAssessment,
  submitProfessionalContributionAssessment,
} from "@/src/services/professional-contribution.service";
import { requireProfessionalContributionAssessmentManagementAccess } from "@/src/services/authorization.service";

export type ProfessionalContributionAssessmentActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * The ADMIN/MANAGER gate here is the coarse one; the finer "may this
 * actor assess THIS employee's role" rule is re-checked independently
 * inside createProfessionalContributionAssessmentCore — never trusting
 * this route-level gate alone, same defense-in-depth pattern as 25I/25H.2A.
 */
export async function createProfessionalContributionAssessmentAction(
  values: unknown,
): Promise<ProfessionalContributionAssessmentActionResult> {
  const authorization = await authorizeAction(() =>
    requireProfessionalContributionAssessmentManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = createProfessionalContributionAssessmentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createProfessionalContributionAssessment(
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

export async function assessProfessionalContributionItemAction(
  values: unknown,
): Promise<ProfessionalContributionAssessmentActionResult> {
  const authorization = await authorizeAction(() =>
    requireProfessionalContributionAssessmentManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = assessProfessionalContributionItemSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await assessProfessionalContributionItem(
    authorization.user,
    parsed.data.assessmentId,
    parsed.data.itemId,
    parsed.data.level,
    parsed.data.observation ?? null,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath(
    `/admin/performance-assessments/professional-contribution/${parsed.data.assessmentId}`,
  );

  return { success: true };
}

export async function submitProfessionalContributionAssessmentAction(
  values: unknown,
): Promise<ProfessionalContributionAssessmentActionResult> {
  const authorization = await authorizeAction(() =>
    requireProfessionalContributionAssessmentManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = submitProfessionalContributionAssessmentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await submitProfessionalContributionAssessment(
    authorization.user,
    parsed.data.assessmentId,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath(
    `/admin/performance-assessments/professional-contribution/${parsed.data.assessmentId}`,
  );
  revalidatePath("/admin/performance-assessments");

  return { success: true };
}

export async function deleteProfessionalContributionAssessmentAction(
  values: unknown,
): Promise<ProfessionalContributionAssessmentActionResult> {
  const authorization = await authorizeAction(() =>
    requireProfessionalContributionAssessmentManagementAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = deleteProfessionalContributionAssessmentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await deleteProfessionalContributionAssessment(
    authorization.user,
    parsed.data.assessmentId,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/admin/performance-assessments");

  return { success: true };
}
