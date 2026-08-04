import type { User, UserRole } from "@prisma/client";
import { Pencil, UserMinus, UserPlus } from "lucide-react";

import { userRoleOptions } from "@/src/lib/constants/user-options";

type UserTableProps = {
  users: User[];
  deactivatingUserId?: string;
  onCreate: () => void;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
};

export default function UserTable({
  users,
  deactivatingUserId,
  onCreate,
  onEdit,
  onDeactivate,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <section className="rounded-4xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <UserPlus className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-[#0f2557]">
          Aucun utilisateur n’a été créé.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Ajoutez les membres de l’équipe RELAIS pour préparer les futures
          affectations commerciales.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-5 font-semibold text-white"
        >
          <UserPlus className="h-4 w-4" />
          Créer le premier utilisateur
        </button>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-sm">
      {/* Mobile / tablet: user cards */}
      <div className="flex flex-col gap-4 p-4 lg:hidden">
        {users.map((user) => (
          <article
            key={user.id}
            className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                {getInitials(user)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-sm text-slate-500">
                  {getRoleLabel(user.role)}
                </p>
              </div>
              <span
                className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                  user.active
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {user.active ? "Actif" : "Inactif"}
              </span>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Téléphone</dt>
                <dd className="font-medium text-slate-700">
                  {user.phone ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">E-mail</dt>
                <dd className="min-w-0 truncate text-right font-medium text-slate-700">
                  {user.email ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Créé le</dt>
                <dd className="font-medium text-slate-700">
                  {formatCreatedAt(user.createdAt)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(user)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Pencil className="h-4 w-4" />
                Modifier
              </button>
              {user.active && (
                <button
                  type="button"
                  onClick={() => onDeactivate(user)}
                  disabled={deactivatingUserId === user.id}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserMinus className="h-4 w-4" />
                  Désactiver
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Desktop: full data table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-245 border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-4">Nom</th>
              <th className="px-5 py-4">Rôle</th>
              <th className="px-5 py-4">Téléphone</th>
              <th className="px-5 py-4">E-mail</th>
              <th className="px-5 py-4">Statut</th>
              <th className="px-5 py-4">Créé le</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="transition hover:bg-slate-50/70">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                      {getInitials(user)}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-5 text-sm text-slate-600">
                  {getRoleLabel(user.role)}
                </td>
                <td className="px-5 py-5 text-sm text-slate-600">
                  {user.phone ?? "—"}
                </td>
                <td className="px-5 py-5 text-sm text-slate-600">
                  {user.email ?? "—"}
                </td>
                <td className="px-5 py-5">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      user.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {user.active ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-5 py-5 text-sm text-slate-500">
                  {formatCreatedAt(user.createdAt)}
                </td>
                <td className="px-6 py-5">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      aria-label={`Modifier ${user.firstName} ${user.lastName}`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {user.active && (
                      <button
                        type="button"
                        onClick={() => onDeactivate(user)}
                        disabled={deactivatingUserId === user.id}
                        aria-label={`Désactiver ${user.firstName} ${user.lastName}`}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getRoleLabel(role: UserRole) {
  return userRoleOptions.find((option) => option.value === role)?.label ?? role;
}

function getInitials(user: User) {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

function formatCreatedAt(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}
