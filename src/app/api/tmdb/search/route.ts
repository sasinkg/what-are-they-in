import { NextResponse } from "next/server";
import { auth } from "@/auth";

const BASE = "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_ACCESS_TOKEN!;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type") ?? "person"; // "person" | "tv" | "movie"

  if (!query) return NextResponse.json({ results: [] });

  const res = await fetch(
    `${BASE}/search/${type}?query=${encodeURIComponent(query)}&language=en-US&page=1`,
    { headers }
  );
  const data = await res.json();
  return NextResponse.json(data);
}
