import { NextRequest, NextResponse } from "next/server";

const BASE = "https://api.themoviedb.org/3";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const type = req.nextUrl.searchParams.get("type") ?? "tv";

  const endpoint =
    type === "movie"
      ? `${BASE}/movie/${id}/credits`
      : `${BASE}/tv/${id}/aggregate_credits`;

  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return NextResponse.json({ cast: [] }, { status: res.status });

  const data = await res.json();

  // Normalize TV aggregate_credits vs movie credits into a common shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cast = (data.cast ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    character:
      type === "movie"
        ? (c.character ?? "")
        : (c.roles?.[0]?.character ?? ""),
    profilePath: c.profile_path ?? null,
    order: c.order ?? 999,
    episodeCount:
      type === "movie" ? undefined : (c.total_episode_count ?? 0),
  }));

  // Sort by billing order so leads appear first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cast.sort((a: any, b: any) => a.order - b.order);

  return NextResponse.json({ cast: cast.slice(0, 300) });
}
