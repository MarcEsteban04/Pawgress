import { NextResponse, type NextRequest } from "next/server";
import { BUCKETS, createSignedUrl, safeFileName } from "@/lib/supabase/storage";
import { getMaterial } from "@/server/materials/queries";

/**
 * The stable URL for a stored file (FR-U6, NFR-S2).
 *
 * A signed URL cannot be embedded in a page. It expires in 30 minutes, so an
 * `<iframe src>` rendered into HTML breaks for a student who leaves the tab open
 * over lunch — and it puts the token in the DOM, in view-source and in the
 * browser's history.
 *
 * So the page points at this app URL instead, and every request mints a fresh
 * signed URL and 302s to it. That buys four things: the token never appears in
 * markup, the link never goes stale, ownership is re-checked on every fetch
 * rather than once at render, and `Content-Disposition` becomes ours to set.
 *
 * `?download=1` returns the file as an attachment. Without it the browser
 * renders inline, which is what the preview needs.
 */

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/subjects/[id]/materials/[materialId]/file">,
) {
  const { id, materialId } = await ctx.params;

  /* Reads through the DAL, so the session check and RLS both apply. A material
     id belonging to someone else comes back null here, exactly as a
     non-existent one does. */
  const material = await getMaterial(materialId);

  /* Not a security check — RLS already settled ownership — but a correctness
     one: `/subjects/A/materials/<id-from-B>` should not serve, because the
     breadcrumb around it would be lying about where the file lives. */
  if (!material || material.subjectId !== id) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!material.storagePath) {
    // A typed note has no object. Nothing to serve, and nothing went wrong.
    return new NextResponse("This material has no file", { status: 404 });
  }

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const signedUrl = await createSignedUrl(BUCKETS.materials, material.storagePath, {
    download: wantsDownload ? downloadName(material.title, material.storagePath) : undefined,
  });

  if (!signedUrl) {
    return new NextResponse("Could not reach that file", { status: 502 });
  }

  const response = NextResponse.redirect(signedUrl, 302);
  /* The target expires, so nothing may cache the redirect that points at it —
     including any CDN between us and the student. */
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

/**
 * What the saved file is called.
 *
 * The title is what the student renamed it to and carries no extension; the
 * storage path's tail is the sanitised original filename and does. Saving
 * "BIO101 lecture 03" with no extension leaves a file the operating system
 * cannot open, so the extension is taken from the path and the name from the
 * title.
 */
function downloadName(title: string, storagePath: string): string {
  const tail = storagePath.split("/").pop() ?? "";
  const extension = tail.includes(".") ? tail.slice(tail.lastIndexOf(".")) : "";
  const base = safeFileName(title) || "file";
  return base.toLowerCase().endsWith(extension.toLowerCase()) ? base : `${base}${extension}`;
}
