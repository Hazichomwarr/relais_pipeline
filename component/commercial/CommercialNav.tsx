import Image from "next/image";
import Link from "next/link";

type CommercialNavProps = {
  firstName: string;
  lastName: string;
};

export default function CommercialNav({
  firstName,
  lastName,
}: CommercialNavProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Relais"
              width={110}
              height={12}
              className="object-contain"
            />
            <span className="hidden text-sm text-slate-500 sm:inline">
              {firstName} {lastName}
            </span>
          </div>

          <form action="/logout" method="POST" className="md:hidden">
            <button
              type="submit"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
            >
              Déconnexion
            </button>
          </form>
        </div>

        <nav className="flex flex-wrap items-center gap-2 md:gap-4">
          <Link
            href="/dashboard/commercial"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Tableau de bord
          </Link>
          <Link
            href="/dashboard/commercial#mes-prospects"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Mes prospects
          </Link>
          <Link
            href="/dashboard/commercial#mes-suivis"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Mes suivis
          </Link>
          <Link
            href="/dashboard/commercial/profile"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Mon profil
          </Link>

          <form action="/logout" method="POST" className="hidden md:block">
            <button
              type="submit"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Déconnexion
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
