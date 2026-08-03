import { redirect } from "next/navigation";

import { auth } from "@/auth";
import LoginForm from "@/component/auth/login-form";

type LoginPageSearchParams = Promise<{ callbackUrl?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: LoginPageSearchParams;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/admin");
  }

  const { callbackUrl } = await searchParams;
  const safeCallbackUrl = isSafeRelativeUrl(callbackUrl) ? callbackUrl : "/admin";

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
      <LoginForm callbackUrl={safeCallbackUrl} />
    </section>
  );
}

function isSafeRelativeUrl(url: string | undefined): url is string {
  return (
    typeof url === "string" && url.startsWith("/") && !url.startsWith("//")
  );
}
