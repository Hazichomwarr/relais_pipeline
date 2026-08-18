import CommercialMobileHeader from "@/component/commercial/CommercialMobileHeader";
import CommercialSidebar from "@/component/commercial/CommercialSidebar";
import Container from "@/component/layout/Container";

type CommercialShellProps = {
  firstName: string;
  lastName: string;
  children: React.ReactNode;
};

/**
 * Owns the same min-w-0/flex-1 + Container gutter contract as AdminShell
 * (Ticket 24B) — previously every route reaching this shell re-wrapped
 * {children} in its own `<main className="px-4 py-6 sm:px-6 sm:py-8">`
 * (missing min-w-0/flex-1), or, for /dashboard/commercial, each page
 * defined its own `<main>` entirely. Centralizing it here means no
 * future page needs to remember to do either.
 */
export default function CommercialShell({
  firstName,
  lastName,
  children,
}: CommercialShellProps) {
  return (
    <div className="flex min-h-screen w-full bg-[#f5f7fb] text-slate-800">
      <CommercialSidebar firstName={firstName} lastName={lastName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <CommercialMobileHeader firstName={firstName} lastName={lastName} />

        <main className="min-w-0 flex-1 py-6 sm:py-8">
          <Container>{children}</Container>
        </main>
      </div>
    </div>
  );
}
