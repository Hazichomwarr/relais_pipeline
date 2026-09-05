import { Search } from "lucide-react";
import Link from "next/link";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialShell from "@/component/commercial/CommercialShell";
import DigitalServicesDirectoryCards from "@/component/products/DigitalServicesDirectoryCards";
import { getProductDirectoryConfig } from "@/src/lib/product-directory";
import { resolveProspectAccess } from "@/src/lib/prospect-access";
import { getAssignedUserName } from "@/src/lib/prospect-ownership";
import { appendReturnTo, buildReturnToPath } from "@/src/lib/return-to";
import { requireRole } from "@/src/services/authorization.service";
import { getDigitalServicesDirectory } from "@/src/services/digital-services-directory.service";

const config = getProductDirectoryConfig("DIGITAL_SERVICES");

type DigitalServicesDirectoryPageProps = {
  searchParams: Promise<{ search?: string }>;
};

/**
 * Full company-wide Digital Services directory (Ticket 15G.2) — replaces
 * the 15G.1 foundation list. Search is name-only, executed in Prisma via
 * digital-services-directory.service, matching the KARMDA directory's own
 * "has this already been prospected?" semantics rather than a broader
 * generic prospect search.
 */
export default async function DigitalServicesDirectoryPage({
  searchParams,
}: DigitalServicesDirectoryPageProps) {
  const user = await requireRole("ADMIN", "MANAGER", "COMMERCIAL");
  const params = await searchParams;
  const search = params.search?.trim() ?? "";

  const prospects = await getDigitalServicesDirectory({ search });
  const returnTo = buildReturnToPath("/products/digital-services", params);

  const items = prospects.map((prospect) => {
    const href = resolveProspectAccess(user, prospect).detailHref;

    return {
      id: prospect.id,
      name: prospect.name,
      businessCategory: prospect.businessCategory,
      status: prospect.status,
      interest: prospect.interest,
      commercialName: getAssignedUserName(prospect),
      nextAction: prospect.nextAction,
      createdAt: prospect.createdAt,
      detailHref: href ? appendReturnTo(href, returnTo) : null,
    };
  });

  const hasSearch = search.length > 0;

  const content = (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/products"
        className="mb-4 inline-block text-sm font-semibold text-slate-500 transition hover:text-[#0f2557]"
      >
        ← Répertoire
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          {config.label}
        </h1>
        <p className="mt-2 text-base text-slate-500">{config.description}</p>
      </div>

      <form
        action="/products/digital-services"
        method="GET"
        className="relative mb-8"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <label htmlFor="digital-services-search" className="sr-only">
          Rechercher une entreprise
        </label>
        <input
          id="digital-services-search"
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Rechercher une entreprise..."
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
        />
      </form>

      {items.length === 0 ? (
        <div className="rounded-4xl border border-slate-200 bg-white p-10 text-center">
          {hasSearch ? (
            <>
              <p className="text-lg font-semibold text-slate-800">
                Aucune entreprise ne correspond à cette recherche.
              </p>
              <Link
                href="/products/digital-services"
                className="mt-4 inline-block font-semibold text-blue-600 hover:underline"
              >
                Réinitialiser la recherche
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-slate-800">
                Aucun prospect Services Digitaux enregistré.
              </p>
              <p className="mt-2 text-slate-500">
                Les entreprises prospectées apparaîtront ici.
              </p>
            </>
          )}
        </div>
      ) : (
        <DigitalServicesDirectoryCards items={items} />
      )}
    </div>
  );

  if (user.role === "COMMERCIAL") {
    return (
      <CommercialShell firstName={user.firstName} lastName={user.lastName}>
        {content}
      </CommercialShell>
    );
  }

  return <AdminShell activeItem="products">{content}</AdminShell>;
}
