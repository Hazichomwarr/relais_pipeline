import type { UserRole } from "@prisma/client";

import ReassignProspectDialog from "@/component/propects/ReassignProspectDialog";
import { ResponsibleUserInfo } from "@/component/propects/prospect-detail-sections";
import type { ProspectResponsibleDisplay } from "@/src/lib/prospect-responsible-display";

type EligibleUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

/**
 * Ticket 28C §3/§5/§6 — the restrained management ownership section:
 * one heading, current assignee, a secondary Réassigner action. Rendered
 * only on /admin/prospects/[id] (ADMIN/MANAGER already gated there by
 * requireRole before this component is ever reached — both roles carry
 * identical 28B reassignment authority, so no further per-viewer check
 * happens inside this component itself).
 */
export default function ProspectResponsibilitySection({
  prospectId,
  responsible,
  eligibleUsers,
}: {
  prospectId: string;
  responsible: ProspectResponsibleDisplay;
  eligibleUsers: EligibleUser[];
}) {
  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[#0f2557]">Responsable du suivi</h2>
          <p className="mt-2 break-words text-base">
            <ResponsibleUserInfo responsible={responsible} />
          </p>
        </div>

        <ReassignProspectDialog
          prospectId={prospectId}
          currentAssigneeId={responsible.assigned ? responsible.userId : null}
          currentAssigneeName={responsible.assigned ? responsible.name : null}
          eligibleUsers={eligibleUsers}
        />
      </div>
    </section>
  );
}
