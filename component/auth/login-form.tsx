"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { FormError } from "@/component/propects/form-error";
import { loginAction } from "@/src/actions/auth.actions";
import { loginSchema, type LoginInput } from "@/src/lib/validations/auth.schema";

const inputClassName =
  "h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await loginAction(values);

    if (!result.success) {
      setServerError(result.message);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  });

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] sm:p-8"
    >
      <h1 className="text-3xl font-bold tracking-tight text-[#0f2557]">
        Connexion
      </h1>
      <p className="mt-2 text-slate-500">
        Accédez au tableau de bord RELAIS.
      </p>

      <div className="mt-8">
        <label htmlFor="email" className="mb-2 block font-semibold text-slate-800">
          Adresse e-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={inputClassName}
          {...register("email")}
        />
        <FormError message={errors.email?.message} />
      </div>

      <div className="mt-6">
        <label htmlFor="password" className="mb-2 block font-semibold text-slate-800">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className={inputClassName}
          {...register("password")}
        />
        <FormError message={errors.password?.message} />
      </div>

      <FormError message={serverError ?? undefined} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-8 h-14 w-full rounded-2xl bg-[#0f2557] text-lg font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Connexion en cours…" : "Se connecter"}
      </button>
    </form>
  );
}
