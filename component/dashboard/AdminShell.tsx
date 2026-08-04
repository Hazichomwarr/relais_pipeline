import AdminMobileHeader from "@/component/dashboard/AdminMobileHeader";
import Sidebar from "@/component/dashboard/Sidebar";

type AdminShellProps = {
  activeItem?: "dashboard" | "followUps" | "users";
  children: React.ReactNode;
};

export default function AdminShell({ activeItem, children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen w-full bg-[#f5f7fb] text-slate-800">
      <Sidebar activeItem={activeItem} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader />

        <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
