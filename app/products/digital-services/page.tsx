import AdminShell from "@/component/dashboard/AdminShell";
import CommercialShell from "@/component/commercial/CommercialShell";
import GenericProductDirectoryList from "@/component/products/GenericProductDirectoryList";
import { getProductDirectoryConfig } from "@/src/lib/product-directory";
import { resolveGenericProductDetailHref } from "@/src/lib/generic-product-directory-navigation";
import { getAssignedUserName } from "@/src/lib/prospect-ownership";
import { requireRole } from "@/src/services/authorization.service";
import { getProspects } from "@/src/services/prospect.service";

const config = getProductDirectoryConfig("DIGITAL_SERVICES");

/**
 * Foundation directory (Ticket 15G.1) — a real, unfiltered, company-wide
 * list rather than "coming soon" copy, since it costs nothing beyond
 * reusing the existing role-neutral prospect list query. Search/business-type
 * filters/dedicated cards are Ticket 15G.2's job.
 */
export default async function DigitalServicesDirectoryPage() {
  const user = await requireRole("ADMIN", "MANAGER", "COMMERCIAL");
  const prospects = await getProspects({ product: "DIGITAL_SERVICES" });

  const items = prospects.map((prospect) => ({
    id: prospect.id,
    name: prospect.name,
    status: prospect.status,
    interest: prospect.interest,
    commercialName: getAssignedUserName(prospect),
    detailHref: resolveGenericProductDetailHref(user, prospect),
  }));

  const content = (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          {config.label}
        </h1>
        <p className="mt-2 text-base text-slate-500">{config.description}</p>
      </div>

      <GenericProductDirectoryList items={items} />
    </div>
  );

  if (user.role === "COMMERCIAL") {
    return (
      <CommercialShell firstName={user.firstName} lastName={user.lastName}>
        <main className="px-4 py-6 sm:px-6 sm:py-8">{content}</main>
      </CommercialShell>
    );
  }

  return <AdminShell activeItem="products">{content}</AdminShell>;
}
