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

/**
 * Ticket 25J §44 — reuses 25I's narrow performance-assessment surface as
 * distinct sections (Role Responsibilities, Professional Contribution)
 * rather than a second disconnected management area. The two domains'
 * data models and scoring semantics remain entirely separate (§28/§73)
 * — this page only shares layout, not logic.
 */
export default async function PerformanceAssessmentsPage() {
  let actorRole: "ADMIN" | "MANAGER";

  try {
    // Both dimensions currently share the exact same coarse ADMIN/MANAGER
    // gate; either require* wrapper resolves the same actor.
    const actor = await requireRoleResponsibilityAssessmentManagementAccess();
    actorRole = actor.role as "ADMIN" | "MANAGER";
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

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
    <AdminShell>
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

        <section className="mt-8">
          <h2 className="text-xl font-bold text-[#0f2557]">
            Responsabilités de rôle
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Les responsabilités spécifiques au rôle de l’employé.
          </p>

          <div className="mt-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h3 className="mb-4 text-lg font-semibold text-[#0f2557]">
              Nouvelle évaluation
            </h3>
            <RoleResponsibilityAssessmentForm
              employees={roleResponsibilityEmployees}
            />
          </div>

          <div className="mt-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h3 className="mb-4 text-lg font-semibold text-[#0f2557]">
              Évaluations existantes
            </h3>
            <RoleResponsibilityAssessmentList
              assessments={roleResponsibilityAssessments}
            />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-[#0f2557]">
            Contribution professionnelle
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Le comportement professionnel observé au-delà des résultats
            commerciaux, de la discipline d’exécution et des
            responsabilités de rôle.
          </p>

          <div className="mt-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h3 className="mb-4 text-lg font-semibold text-[#0f2557]">
              Nouvelle évaluation
            </h3>
            <ProfessionalContributionAssessmentForm
              employees={professionalContributionEmployees}
            />
          </div>

          <div className="mt-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h3 className="mb-4 text-lg font-semibold text-[#0f2557]">
              Évaluations existantes
            </h3>
            <ProfessionalContributionAssessmentList
              assessments={professionalContributionAssessments}
            />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
