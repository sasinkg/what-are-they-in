import { NextResponse } from "next/server";
import { auth } from "@/auth";

const BASE = "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_ACCESS_TOKEN!;
const headers = { Authorization: `Bearer ${TOKEN}` };

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [details, credits] = await Promise.all([
    fetch(`${BASE}/person/${id}?language=en-US`, { headers }).then((r) => r.json()),
    fetch(`${BASE}/person/${id}/combined_credits?language=en-US`, { headers }).then((r) => r.json()),
  ]);

  return NextResponse.json({ ...details, credits });
}
