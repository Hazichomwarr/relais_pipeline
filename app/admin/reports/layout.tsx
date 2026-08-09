import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import {
  AuthorizationError,
  requireDailyReportManagementAccess,
} from "@/src/services/authorization.service";

/**
 * Management-wide daily report visibility is ADMIN/MANAGER only (Ticket
 * 19A's requireDailyReportManagementAccess — reused here rather than a
 * second authorization policy, per Ticket 19C). This runs before any
 * report data is fetched by nested pages, so a COMMERCIAL user never sees
 * partial dashboard data.
 */
export default async function AdminReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireDailyReportManagementAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(
        error.code === "UNAUTHENTICATED" ? "/login" : "/dashboard/commercial",
      );
    }
    throw error;
  }

  return <AdminShell activeItem="reportsManagement">{children}</AdminShell>;
}
