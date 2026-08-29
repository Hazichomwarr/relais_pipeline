import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import RoleResponsibilityAssessmentForm from "@/component/admin/RoleResponsibilityAssessmentForm";
import RoleResponsibilityAssessmentList from "@/component/admin/RoleResponsibilityAssessmentList";
import ProfessionalContributionAssessmentForm from "@/component/admin/ProfessionalContributionAssessmentForm";
import ProfessionalContributionAssessmentList from "@/component/admin/ProfessionalContributionAssessmentList";
import {
  AuthorizationError,
  requireRoleResponsibilityAssessmentManagementAccess,
} from "@/src/services/authorization.service";
import {
  listEligibleEmployeesForRoleResponsibilityAssessment,
  listRoleResponsibilityAssessmentsForManagement,
} from "@/src/services/role-responsibility-assessment.service";
import {
  listEligibleEmployeesForProfessionalContribution,
  listProfessionalContributionAssessmentsForManagement,
} from "@/src/services/professional-contribution.service";

type PerformanceAssessmentsSearchParams = Promise<{
  employeeId?: string;
  year?: string;
  month?: string;
}>;

/**
 * Ticket 25K.1 §7/§9 — deep-link prefill only. employeeId/year/month are
 * read from the query string purely to pre-fill the two create forms'
 * defaultValues; they carry no authority of their own; the Server
 * Actions those forms submit to still fully re-validate every field
 * (§43), so a tampered or nonsensical value here can, at worst, leave a
 * form pre-filled with something invalid — never something unsafe.
 */
function parsePrefillMonth(raw: string | undefined): number | undefined {
  const value = raw ? Number(raw) : NaN;
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : undefined;
}

function parsePrefillYear(raw: string | undefined): number | undefined {
  const value = raw ? Number(raw) : NaN;
  return Number.isInteger(value) ? value : undefined;
}

/**
 * Ticket 25J §44 — reuses 25I's narrow performance-assessment surface as
 * distinct sections (Role Responsibilities, Professional Contribution)
 * rather than a second disconnected management area. The two domains'
 * data models and scoring semantics remain entirely separate (§28/§73)
 * — this page only shares layout, not logic.
 */
export default async function PerformanceAssessmentsPage({
  searchParams,
}: {
  searchParams: PerformanceAssessmentsSearchParams;
}) {
  let actor: { id: string; role: "ADMIN" | "MANAGER" };
  let actorRole: "ADMIN" | "MANAGER";

  try {
    // Both dimensions currently share the exact same coarse ADMIN/MANAGER
    // gate (Ticket 25O §3/§22: this is the VIEW boundary, preserved —
    // Manager keeps read-only access to this list; only the create
    // forms below are now ADMIN-only, and every mutation is
    // independently re-authorized server-side regardless of this gate).
    const authenticated = await requireRoleResponsibilityAssessmentManagementAccess();
    actorRole = authenticated.role as "ADMIN" | "MANAGER";
    actor = { id: authenticated.id, role: actorRole };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const params = await searchParams;
  const initialEmployeeId = params.employeeId || undefined;
  const initialYear = parsePrefillYear(params.year);
  const initialMonth = parsePrefillMonth(params.month);

  const [
    roleResponsibilityEmployees,
    roleResponsibilityAssessments,
    professionalContributionEmployees,
    professionalContributionAssessments,
  ] = await Promise.all([
    listEligibleEmployeesForRoleResponsibilityAssessment(),
    listRoleResponsibilityAssessmentsForManagement(actorRole),
    listEligibleEmployeesForProfessionalContribution(),
    listProfessionalContributionAssessmentsForManagement(actorRole),
  ]);

  return (
    <AdminShell activeItem="performance">
      <div>
        <header className="mb-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Performance
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl md:text-5xl">
            Évaluations de performance
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Évaluez les responsabilités de rôle et la contribution
            professionnelle des employés pour un mois déjà terminé. Ces
            évaluations sont distinctes des résultats commerciaux et de la
            discipline d’exécution.
          </p>
        </header>

        <section id="role-responsibility" className="mt-8 scroll-mt-20">
          <h2 className="text-xl font-bold text-[#0f2557]">
            Responsabilités de rôle
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Les responsabilités spécifiques au rôle de l’employé.
          </p>

          {actorRole === "ADMIN" ? (
            <div className="mt-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h3 className="mb-4 text-lg font-semibold text-[#0f2557]">
                Nouvelle évaluation
              </h3>
              <RoleResponsibilityAssessmentForm
                employees={roleResponsibilityEmployees}
                initialEmployeeId={initialEmployeeId}
                initialYear={initialYear}
                initialMonth={initialMonth}
              />
            </div>
          ) : null}

          <div className="mt-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h3 className="mb-4 text-lg font-semibold text-[#0f2557]">
              Évaluations existantes
            </h3>
            <RoleResponsibilityAssessmentList
              assessments={roleResponsibilityAssessments}
              actor={actor}
            />
          </div>
        </section>

        <section id="professional-contribution" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-bold text-[#0f2557]">
            Contribution professionnelle
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Le comportement professionnel observé au-delà des résultats
            commerciaux, de la discipline d’exécution et des
            responsabilités de rôle.
          </p>

          {actorRole === "ADMIN" ? (
            <div className="mt-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h3 className="mb-4 text-lg font-semibold text-[#0f2557]">
                Nouvelle évaluation
              </h3>
              <ProfessionalContributionAssessmentForm
                employees={professionalContributionEmployees}
                initialEmployeeId={initialEmployeeId}
                initialYear={initialYear}
                initialMonth={initialMonth}
              />
            </div>
          ) : null}

          <div className="mt-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h3 className="mb-4 text-lg font-semibold text-[#0f2557]">
              Évaluations existantes
            </h3>
            <ProfessionalContributionAssessmentList
              assessments={professionalContributionAssessments}
              actor={actor}
            />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
