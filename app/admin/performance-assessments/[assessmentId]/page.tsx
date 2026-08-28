import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import RoleResponsibilityAssessmentDetail from "@/component/admin/RoleResponsibilityAssessmentDetail";
import {
  AuthorizationError,
  requireRoleResponsibilityAssessmentManagementAccess,
} from "@/src/services/authorization.service";
import { getRoleResponsibilityAssessmentDetail } from "@/src/services/role-responsibility-assessment.service";

type PageParams = Promise<{ assessmentId: string }>;

export default async function RoleResponsibilityAssessmentDetailPage({
  params,
}: {
  params: PageParams;
}) {
  try {
    await requireRoleResponsibilityAssessmentManagementAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const { assessmentId } = await params;
  const assessment = await getRoleResponsibilityAssessmentDetail(assessmentId);

  if (!assessment) {
    notFound();
  }

  return (
    <AdminShell>
      <div>
        <Link
          href="/admin/performance-assessments"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux évaluations
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          {assessment.employee.firstName} {assessment.employee.lastName}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Responsabilités de rôle —{" "}
          {assessment.roleAtEvaluation === "COMMERCIAL"
            ? "Commercial"
            : "Manager"}
        </p>

        <div className="mt-7 space-y-6">
          <RoleResponsibilityAssessmentDetail
            assessmentId={assessment.id}
            status={assessment.status}
            score={assessment.score}
            maxScore={assessment.maxScore}
            employeeName={`${assessment.employee.firstName} ${assessment.employee.lastName}`}
            items={assessment.items}
          />
        </div>
      </div>
    </AdminShell>
  );
}
