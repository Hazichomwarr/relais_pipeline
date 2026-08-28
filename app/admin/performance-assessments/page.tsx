import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import RoleResponsibilityAssessmentForm from "@/component/admin/RoleResponsibilityAssessmentForm";
import RoleResponsibilityAssessmentList from "@/component/admin/RoleResponsibilityAssessmentList";
import {
  AuthorizationError,
  requireRoleResponsibilityAssessmentManagementAccess,
} from "@/src/services/authorization.service";
import {
  listEligibleEmployeesForRoleResponsibilityAssessment,
  listRoleResponsibilityAssessmentsForManagement,
} from "@/src/services/role-responsibility-assessment.service";

export default async function RoleResponsibilityAssessmentsPage() {
  let actorRole: "ADMIN" | "MANAGER";

  try {
    const actor = await requireRoleResponsibilityAssessmentManagementAccess();
    actorRole = actor.role as "ADMIN" | "MANAGER";
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const [employees, assessments] = await Promise.all([
    listEligibleEmployeesForRoleResponsibilityAssessment(),
    listRoleResponsibilityAssessmentsForManagement(actorRole),
  ]);

  return (
    <AdminShell>
      <div>
        <header className="mb-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Performance
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl md:text-5xl">
            Responsabilités de rôle
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Évaluez si un employé a rempli les responsabilités spécifiques à
            son rôle pour un mois déjà terminé. Cette évaluation est
            distincte des résultats commerciaux et de la discipline
            d’exécution.
          </p>
        </header>

        <section className="mt-7 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-4 text-lg font-semibold text-[#0f2557]">
            Nouvelle évaluation
          </h2>
          <RoleResponsibilityAssessmentForm employees={employees} />
        </section>

        <section className="mt-6 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-4 text-lg font-semibold text-[#0f2557]">
            Évaluations existantes
          </h2>
          <RoleResponsibilityAssessmentList assessments={assessments} />
        </section>
      </div>
    </AdminShell>
  );
}
