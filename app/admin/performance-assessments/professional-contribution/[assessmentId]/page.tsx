import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import ProfessionalContributionAssessmentDetail from "@/component/admin/ProfessionalContributionAssessmentDetail";
import {
  AuthorizationError,
  requireProfessionalContributionAssessmentManagementAccess,
} from "@/src/services/authorization.service";
import { canMutateOwnedStructuredEvaluation } from "@/src/lib/employee-assessment-authorization";
import { canViewEmployeePerformance } from "@/src/services/performance-summary.service-core";
import { getProfessionalContributionAssessmentDetail } from "@/src/services/professional-contribution.service";

type PageParams = Promise<{ assessmentId: string }>;

export default async function ProfessionalContributionAssessmentDetailPage({
  params,
}: {
  params: PageParams;
}) {
  let actor: { id: string; role: "ADMIN" | "MANAGER" };

  try {
    const authenticated = await requireProfessionalContributionAssessmentManagementAccess();
    actor = { id: authenticated.id, role: authenticated.role as "ADMIN" | "MANAGER" };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const { assessmentId } = await params;
  const assessment = await getProfessionalContributionAssessmentDetail(
    assessmentId,
  );

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

  // Ticket 25O §12/§17: editing requires current ADMIN authority AND
  // recorded-evaluator identity — canMutateOwnedStructuredEvaluation is
  // the exact same check assessProfessionalContributionItemCore/submit
  // now enforce server-side, so a legacy MANAGER-owned draft (or an
  // ADMIN viewing someone else's draft) correctly renders read-only
  // here instead of offering controls that would fail on click.
  const canEdit =
    assessment.status === "DRAFT" &&
    canMutateOwnedStructuredEvaluation(actor, assessment.evaluatorUserId);

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
          Contribution professionnelle —{" "}
          {assessment.roleAtEvaluation === "COMMERCIAL"
            ? "Commercial"
            : "Manager"}
        </p>

        <div className="mt-7 space-y-6">
          <ProfessionalContributionAssessmentDetail
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
