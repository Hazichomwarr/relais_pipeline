/**
 * The one page-width primitive for authenticated dashboard/admin pages
 * (Ticket 24B): horizontal gutters and shrink-safety, nothing else. It
 * intentionally has no max-width — RELAIS CRM's data-heavy screens
 * (Finances, Prospects, Actions, Analytics, Reports, Users) need the
 * full width available beside the sidebar. A page that genuinely wants
 * narrower reading content (e.g. a note editor) constrains itself with
 * its own max-w-* inside Container, rather than Container imposing one
 * on every page. Container also owns no vertical spacing — page title
 * margins, section spacing, and card spacing stay wherever they already
 * live.
 */
export default function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full min-w-0 px-4 sm:px-6 lg:px-8 ${className}`.trim()}>
      {children}
    </div>
  );
}
