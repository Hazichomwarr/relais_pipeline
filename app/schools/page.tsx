import { Search } from "lucide-react";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialShell from "@/component/commercial/CommercialShell";
import SchoolDirectoryCards from "@/component/schools/SchoolDirectoryCards";
import { resolveSchoolDetailHref } from "@/src/lib/school-directory-navigation";
import { requireRole } from "@/src/services/authorization.service";
import { listSchools } from "@/src/services/school-directory.service";

type SchoolsPageProps = {
  searchParams: Promise<{ search?: string }>;
};

export default async function SchoolsPage({ searchParams }: SchoolsPageProps) {
  const user = await requireRole("ADMIN", "MANAGER", "COMMERCIAL");
  const params = await searchParams;
  const search = params.search?.trim() ?? "";

  const schools = await listSchools({ search });

  const content = (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          Toutes les écoles
        </h1>
        <p className="mt-2 text-base text-slate-500">
          Vérifiez si un établissement a déjà été prospecté avant une visite.
        </p>
      </div>

      <form action="/schools" method="GET" className="relative mb-8">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Rechercher une école..."
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
        />
      </form>

      <SchoolDirectoryCards
        schools={schools}
        resolveHref={(school) => resolveSchoolDetailHref(user, school)}
      />
    </div>
  );

  if (user.role === "COMMERCIAL") {
    return (
      <CommercialShell firstName={user.firstName} lastName={user.lastName}>
        <main className="px-4 py-6 sm:px-6 sm:py-8">{content}</main>
      </CommercialShell>
    );
  }

  return <AdminShell activeItem="schools">{content}</AdminShell>;
}
