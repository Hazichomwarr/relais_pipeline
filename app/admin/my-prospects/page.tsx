import { redirect } from "next/navigation";

import AdminMyProspectsFilters from "@/component/admin/AdminMyProspectsFilters";
import AdminMyProspectsKpis from "@/component/admin/AdminMyProspectsKpis";
import AdminMyProspectsList from "@/component/admin/AdminMyProspectsList";
import AdminShell from "@/component/dashboard/AdminShell";
import { buildReturnToPath } from "@/src/lib/return-to";
import {
  AuthorizationError,
  requireAdmin,
} from "@/src/services/authorization.service";
import {
  getAdminMyProspects,
  getAdminMyProspectsKpis,
} from "@/src/services/admin-my-prospects.service";
import type {
  ProspectStatus,
  RelaisProduct,
} from "@prisma/client";

type AdminMyProspectsSearchParams = Promise<{
  q?: string;
  product?: string;
  status?: string;
}>;

export default async function AdminMyProspectsPage({
  searchParams,
}: {
  searchParams: AdminMyProspectsSearchParams;
}) {
  let admin;

  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const params = await searchParams;
  const filters = {
    search: params.q,
    product: params.product as RelaisProduct | undefined,
    status: params.status as ProspectStatus | undefined,
  };

  const [prospects, kpis] = await Promise.all([
    getAdminMyProspects(admin.id, filters),
    getAdminMyProspectsKpis(admin.id),
  ]);

  const returnTo = buildReturnToPath("/admin/my-prospects", params);

  return (
    <AdminShell activeItem="myProspects">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl">
            Mes prospects
          </h1>
          <p className="mt-2 text-slate-500">
            Les opportunités que vous avez personnellement apportées.
          </p>
        </header>

        <div className="mb-6">
          <AdminMyProspectsKpis kpis={kpis} />
        </div>

        <AdminMyProspectsFilters />

        <AdminMyProspectsList
          prospects={prospects}
          hasOwnedProspects={kpis.total > 0}
          returnTo={returnTo}
        />
      </div>
    </AdminShell>
  );
}
