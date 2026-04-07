import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.entry.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.entry.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    tmdbPersonId,
    personName,
    personPhoto,
    tmdbShowId,
    showName,
    showPoster,
    showType,
    characterName,
    roleType,
  } = body;

  if (!tmdbPersonId || !personName || !tmdbShowId || !showName || !roleType) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const entry = await prisma.entry.upsert({
    where: {
      userId_tmdbPersonId_tmdbShowId: {
        userId: session.user.id,
        tmdbPersonId,
        tmdbShowId,
      },
    },
    update: { characterName, roleType },
    create: {
      userId: session.user.id,
      tmdbPersonId,
      personName,
      personPhoto,
      tmdbShowId,
      showName,
      showPoster,
      showType: showType ?? "tv",
      characterName,
      roleType,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
