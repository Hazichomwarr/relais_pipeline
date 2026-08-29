import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import RoleResponsibilityAssessmentDetail from "@/component/admin/RoleResponsibilityAssessmentDetail";
import {
  AuthorizationError,
  requireRoleResponsibilityAssessmentManagementAccess,
} from "@/src/services/authorization.service";
import { canViewEmployeePerformance } from "@/src/services/performance-summary.service-core";
import { getRoleResponsibilityAssessmentDetail } from "@/src/services/role-responsibility-assessment.service";

type PageParams = Promise<{ assessmentId: string }>;

export default async function RoleResponsibilityAssessmentDetailPage({
  params,
}: {
  params: PageParams;
}) {
  let actor: { id: string; role: "ADMIN" | "MANAGER" };

  try {
    const authenticated = await requireRoleResponsibilityAssessmentManagementAccess();
    actor = { id: authenticated.id, role: authenticated.role as "ADMIN" | "MANAGER" };
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

  // Ticket 25K.2 §27 — an assessment id in the URL is untrusted: the
  // coarse ADMIN/MANAGER gate above proves nothing about THIS employee.
  // Re-check the same view authority the 25K dashboard uses before
  // rendering anything about this specific assessment. Not found rather
  // than an access-denied message, so an unauthorized id doesn't confirm
  // the assessment's existence.
  if (!canViewEmployeePerformance(actor.role, assessment.roleAtEvaluation)) {
    notFound();
  }

  // Ticket 25K.2 §28/§29 — editing is evaluator-exclusive in 25I's own
  // domain core (assessRoleResponsibilityItemCore/submit/delete all
  // reject any actor.id other than evaluatorUserId); this mirrors that
  // shipped policy for the page's read-only/editable split rather than
  // inventing a broader "any authorized manager may continue" rule the
  // domain never actually offers.
  const canEdit =
    assessment.status === "DRAFT" && actor.id === assessment.evaluatorUserId;

  // Ticket 25K.1 §24 — derived from the assessment's own already-loaded
  // period/employee, not a forwarded query param: this link works
  // whether or not the visitor arrived from the dashboard.
  const dashboardHref = `/admin/performance?employeeId=${assessment.employeeUserId}&year=${assessment.periodStart.getUTCFullYear()}&month=${assessment.periodStart.getUTCMonth() + 1}`;

  return (
    <AdminShell activeItem="performance">
      <div>
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Link
            href="/admin/performance-assessments"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux évaluations
          </Link>
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la vue d’ensemble
          </Link>
        </div>

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
            evaluatorName={`${assessment.evaluator.firstName} ${assessment.evaluator.lastName}`}
            canEdit={canEdit}
            items={assessment.items}
          />
        </div>
      </div>
    </AdminShell>
  );
}
