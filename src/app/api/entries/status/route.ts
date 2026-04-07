import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const BASE = "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_ACCESS_TOKEN!;
const tmdbHeaders = { Authorization: `Bearer ${TOKEN}` };

// Returns whether there are any missing connections between actors and shows on the board
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.entry.findMany({ where: { userId: session.user.id } });
  if (existing.length === 0) return NextResponse.json({ complete: true, pending: 0 });

  const persons = new Map<number, string>();
  const showsOnBoard = new Set<number>();
  const existingPairs = new Set<string>();

  for (const e of existing) {
    persons.set(e.tmdbPersonId, e.personName);
    showsOnBoard.add(e.tmdbShowId);
    existingPairs.add(`${e.tmdbPersonId}-${e.tmdbShowId}`);
  }

  let pending = 0;

  for (const [personId] of persons) {
    try {
      const res = await fetch(
        `${BASE}/person/${personId}/combined_credits?language=en-US`,
        { headers: tmdbHeaders }
      );
      const data = await res.json();
      const credits = [...(data.cast ?? []), ...(data.crew ?? [])];
      for (const credit of credits) {
        if (showsOnBoard.has(credit.id) && !existingPairs.has(`${personId}-${credit.id}`)) {
          pending++;
        }
      }
    } catch {
      // skip
    }
  }

  return NextResponse.json({ complete: pending === 0, pending });
}
