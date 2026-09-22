import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/features/auth/session";
import { signedDocumentUrl } from "@/features/compliance/queries";

/**
 * Redirects to a five-minute signed URL. Storage paths never reach the
 * browser as durable links, and the RLS check happens before the signature
 * is issued.
 */
export async function GET(request: NextRequest) {
  await requireAdmin(["super_admin", "operations", "compliance"]);

  const path = request.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });

  const url = await signedDocumentUrl(path);
  if (!url) return new NextResponse("Document not found", { status: 404 });

  return NextResponse.redirect(url);
}
