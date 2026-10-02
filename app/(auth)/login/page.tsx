import Link from "next/link";
import { AuthCard } from "@/components/layout/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = { title: "Sign in — Brighttemp" };

/**
 * Reads ?next= and ?error= on the server and hands them to the client form.
 * Using useSearchParams() in the client instead forces a Suspense boundary
 * and fails the production build.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = next?.startsWith("/") ? next : "";

  return (
    <AuthCard
      title="Sign in"
      lede="Practices, locums and Brighttemp staff all sign in here."
      footer={
        <>
          No account yet?{" "}
          <Link href="/register/practice" className="font-semibold text-[#0E3B36] underline">
            Register a practice
          </Link>{" "}
          or{" "}
          <Link href="/register/locum" className="font-semibold text-[#0E3B36] underline">
            join as a locum
          </Link>
          .
        </>
      }
    >
      <LoginForm next={safeNext} linkError={error} />
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="text-[#5E7370] underline">
          Forgotten your password?
        </Link>
      </p>
    </AuthCard>
  );
}
