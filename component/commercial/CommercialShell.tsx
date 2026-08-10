import CommercialMobileHeader from "@/component/commercial/CommercialMobileHeader";
import CommercialSidebar from "@/component/commercial/CommercialSidebar";

type CommercialShellProps = {
  firstName: string;
  lastName: string;
  children: React.ReactNode;
};

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
        {children}
      </div>
    </div>
  );
}
