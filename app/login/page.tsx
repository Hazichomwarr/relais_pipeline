import { redirect } from "next/navigation";

import { auth } from "@/auth";
import LoginForm from "@/component/auth/login-form";
import { resolveSafeCallbackUrl } from "@/src/lib/callback-url";

type LoginPageSearchParams = Promise<{ callbackUrl?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: LoginPageSearchParams;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  const { callbackUrl } = await searchParams;
  const safeCallbackUrl = resolveSafeCallbackUrl(callbackUrl);

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
      <LoginForm callbackUrl={safeCallbackUrl} />
    </section>
  );
}
