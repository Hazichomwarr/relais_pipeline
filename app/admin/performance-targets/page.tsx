import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialPerformanceTargetForm from "@/component/admin/CommercialPerformanceTargetForm";
import CommercialPerformanceTargetList from "@/component/admin/CommercialPerformanceTargetList";
import {
  AuthorizationError,
  requireCommercialPerformanceTargetManagementAccess,
} from "@/src/services/authorization.service";
import { listCommercialResultsTargetEligibleUsers } from "@/src/services/user.service";
import { listCommercialPerformanceTargetsForManagement } from "@/src/services/commercial-performance-target.service";

/**
 * Ticket 25H.2A — authorization for this route used to be covered
 * entirely by app/admin/layout.tsx's ADMIN/MANAGER-only gate, which was
 * exactly COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES. Ticket 25R
 * widened that shell gate to also admit ASSISTANT
 * (requireDashboardAccess), so this route now needs its own explicit,
 * narrower check — reusing the existing
 * requireCommercialPerformanceTargetManagementAccess() the Server Actions
 * already call, rather than inventing a second policy for the same
 * capability.
 *
 * Ticket 25P §34: the employee list comes from
 * listCommercialResultsTargetEligibleUsers (COMMERCIAL + MANAGER) — a
 * dedicated eligibility query, not the Commercial-only helper this page
 * used before.
 */
export default async function CommercialPerformanceTargetsPage() {
  try {
    await requireCommercialPerformanceTargetManagementAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const [eligibleEmployees, targets] = await Promise.all([
    listCommercialResultsTargetEligibleUsers(),
    listCommercialPerformanceTargetsForManagement(),
  ]);

  return (
    <AdminShell activeItem="performance">
      <div>
        <header className="mb-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Performance
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl md:text-5xl">
            Objectifs commerciaux
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Définissez le nombre de prospects gagnés attendu pour un
            commercial ou un manager sur un mois à venir. Une fois le mois
            commencé, l’objectif est verrouillé afin de préserver
            l’historique de l’évaluation.
          </p>
        </header>

        <section className="mt-7 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-4 text-lg font-semibold text-[#0f2557]">
            Nouvel objectif
          </h2>
          <CommercialPerformanceTargetForm eligibleEmployees={eligibleEmployees} />
        </section>

        <section className="mt-6 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-4 text-lg font-semibold text-[#0f2557]">
            Objectifs existants
          </h2>
          <CommercialPerformanceTargetList targets={targets} />
        </section>
      </div>
    </AdminShell>
  );
}
