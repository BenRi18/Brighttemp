import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { demoPreviewEnabled } from "@/features/dev/demo";

/**
 * A small pill in the corner of every page in development, showing who you
 * are signed in as and linking back to the page preview. Renders nothing in
 * production.
 */
export async function DevToolbar() {
  if (!demoPreviewEnabled()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata?.user_type as string | undefined) ?? "visitor";

  return (
    <Link
      href="/dev"
      className="fixed bottom-4 right-4 z-[100] rounded-full bg-[#12211F] px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-pine"
    >
      Preview · {user ? `${role} (${user.email})` : "visitor"} · switch
    </Link>
  );
}
