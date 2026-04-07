import { NextResponse } from "next/server";

// Proxies TMDB images through the server so canvas can draw them without CORS issues
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url || !url.startsWith("https://image.tmdb.org/")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const res = await fetch(url);
  if (!res.ok) return new NextResponse("Not found", { status: 404 });

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
