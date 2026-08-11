import { redirect } from "next/navigation";

type SchoolsRedirectSearchParams = Promise<{ search?: string }>;

/**
 * /products/karmda is now the canonical KARMDA directory (Ticket 15G.1);
 * this route only exists to keep old /schools bookmarks/links working.
 * Authorization already happened in app/schools/layout.tsx before this
 * page ever runs, so it does nothing else — just preserves ?search=.
 */
export default async function SchoolsRedirectPage({
  searchParams,
}: {
  searchParams: SchoolsRedirectSearchParams;
}) {
  const params = await searchParams;
  const query = params.search
    ? `?search=${encodeURIComponent(params.search)}`
    : "";

  redirect(`/products/karmda${query}`);
}
