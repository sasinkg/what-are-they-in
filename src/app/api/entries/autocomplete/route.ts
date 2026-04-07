import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const BASE = "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_ACCESS_TOKEN!;
const IMG = "https://image.tmdb.org/t/p/w92";

const tmdbHeaders = { Authorization: `Bearer ${TOKEN}` };

type TMDBCredit = {
  id: number;
  name?: string;
  title?: string;
  poster_path: string | null;
  media_type: string;
  character?: string;
};

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get all existing entries for this user
  const existing = await prisma.entry.findMany({ where: { userId } });

  if (existing.length === 0) {
    return NextResponse.json({ added: [], message: "Nothing on the board yet." });
  }

  // Unique persons and shows on the board
  const persons = new Map<number, { name: string; photo: string | null }>();
  const showsOnBoard = new Map<number, { name: string; poster: string | null; type: string }>();
  const existingPairs = new Set<string>();

  for (const e of existing) {
    persons.set(e.tmdbPersonId, { name: e.personName, photo: e.personPhoto });
    showsOnBoard.set(e.tmdbShowId, { name: e.showName, poster: e.showPoster, type: e.showType });
    existingPairs.add(`${e.tmdbPersonId}-${e.tmdbShowId}`);
  }

  const added: typeof existing = [];

  // For each actor, fetch TMDB credits and find connections to shows on the board
  for (const [personId, personData] of persons) {
    let credits: TMDBCredit[] = [];
    try {
      const res = await fetch(
        `${BASE}/person/${personId}/combined_credits?language=en-US`,
        { headers: tmdbHeaders }
      );
      const data = await res.json();
      credits = [...(data.cast ?? []), ...(data.crew ?? [])];
    } catch {
      continue;
    }

    for (const credit of credits) {
      if (!showsOnBoard.has(credit.id)) continue;
      const pair = `${personId}-${credit.id}`;
      if (existingPairs.has(pair)) continue;

      const showData = showsOnBoard.get(credit.id)!;
      const characterName = credit.character?.trim() || null;
      // Default role type based on media type
      const roleType = "GUEST";

      try {
        const entry = await prisma.entry.create({
          data: {
            userId,
            tmdbPersonId: personId,
            personName: personData.name,
            personPhoto: personData.photo
              ? personData.photo
              : credit.id
              ? null
              : null,
            tmdbShowId: credit.id,
            showName: showData.name,
            showPoster: showData.poster,
            showType: showData.type,
            characterName,
            roleType,
          },
        });
        added.push(entry);
        existingPairs.add(pair);
      } catch {
        // skip duplicates or errors
      }
    }
  }

  return NextResponse.json({
    added,
    message:
      added.length === 0
        ? "No new connections found."
        : `Found ${added.length} new connection${added.length === 1 ? "" : "s"}.`,
  });
}
