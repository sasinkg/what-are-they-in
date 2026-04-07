"use client";

import { useState, useEffect, useRef } from "react";

type TMDBPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
};

type TMDBShow = {
  id: number;
  name?: string;
  title?: string;
  poster_path: string | null;
  media_type?: string;
  first_air_date?: string;
  release_date?: string;
};

type RoleType = "MAIN" | "RECURRING" | "GUEST" | "CAMEO";

const ROLE_OPTIONS: RoleType[] = ["MAIN", "RECURRING", "GUEST", "CAMEO"];
const IMG = "https://image.tmdb.org/t/p/w92";

export default function AddEntrySheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAdded: (entry: any) => void;
}) {
  const [step, setStep] = useState<"person" | "show" | "role">("person");
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<TMDBPerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<TMDBPerson | null>(null);
  const [showQuery, setShowQuery] = useState("");
  const [showResults, setShowResults] = useState<TMDBShow[]>([]);
  const [selectedShow, setSelectedShow] = useState<TMDBShow | null>(null);
  const [characterName, setCharacterName] = useState("");
  const [characterLoading, setCharacterLoading] = useState(false);
  const [roleType, setRoleType] = useState<RoleType>("MAIN");
  const [saving, setSaving] = useState(false);
  const personTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("person");
      setPersonQuery("");
      setPersonResults([]);
      setSelectedPerson(null);
      setShowQuery("");
      setShowResults([]);
      setSelectedShow(null);
      setCharacterName("");
      setRoleType("MAIN");
    }
  }, [open]);

  useEffect(() => {
    if (personTimer.current) clearTimeout(personTimer.current);
    if (!personQuery.trim()) { setPersonResults([]); return; }
    personTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(personQuery)}&type=person`);
      const data = await res.json();
      setPersonResults(data.results ?? []);
    }, 350);
  }, [personQuery]);

  useEffect(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (!showQuery.trim()) { setShowResults([]); return; }
    showTimer.current = setTimeout(async () => {
      const [tv, movies] = await Promise.all([
        fetch(`/api/tmdb/search?q=${encodeURIComponent(showQuery)}&type=tv`).then((r) => r.json()),
        fetch(`/api/tmdb/search?q=${encodeURIComponent(showQuery)}&type=movie`).then((r) => r.json()),
      ]);
      const combined = [
        ...(tv.results ?? []).map((s: TMDBShow) => ({ ...s, media_type: "tv" })),
        ...(movies.results ?? []).map((s: TMDBShow) => ({ ...s, media_type: "movie" })),
      ];
      setShowResults(combined);
    }, 350);
  }, [showQuery]);

  // Auto-fetch character name from TMDB when both person and show are selected
  async function fetchCharacterName(person: TMDBPerson, show: TMDBShow) {
    setCharacterLoading(true);
    setCharacterName("");
    try {
      const res = await fetch(`/api/tmdb/person/${person.id}`);
      const data = await res.json();
      const allCredits = [
        ...(data.credits?.cast ?? []),
        ...(data.credits?.crew ?? []),
      ];
      const match = allCredits.find(
        (c: { id: number; character?: string }) => c.id === show.id
      );
      if (match?.character) {
        setCharacterName(match.character);
      }
    } finally {
      setCharacterLoading(false);
    }
  }

  function selectShow(show: TMDBShow) {
    setSelectedShow(show);
    setStep("role");
    if (selectedPerson) fetchCharacterName(selectedPerson, show);
  }

  async function handleSave() {
    if (!selectedPerson || !selectedShow) return;
    setSaving(true);
    const showName = selectedShow.name ?? selectedShow.title ?? "";
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdbPersonId: selectedPerson.id,
        personName: selectedPerson.name,
        personPhoto: selectedPerson.profile_path ? `${IMG}${selectedPerson.profile_path}` : null,
        tmdbShowId: selectedShow.id,
        showName,
        showPoster: selectedShow.poster_path ? `${IMG}${selectedShow.poster_path}` : null,
        showType: selectedShow.media_type ?? "tv",
        characterName: characterName.trim() || null,
        roleType,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const entry = await res.json();
      onAdded(entry);
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 rounded-t-3xl w-full max-h-[85vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>

        <div className="px-4 pb-2 shrink-0">
          <h2 className="text-lg font-bold">Add to Your Graph</h2>
          <p className="text-zinc-500 text-sm">
            {step === "person" && "Search for an actor"}
            {step === "show" && `Which show is ${selectedPerson?.name} in?`}
            {step === "role" && `${selectedPerson?.name} in ${selectedShow?.name ?? selectedShow?.title}`}
          </p>
        </div>

        {/* Steps */}
        <div className="flex gap-1.5 px-4 pb-3 shrink-0">
          {(["person", "show", "role"] as const).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= ["person", "show", "role"].indexOf(step) ? "bg-indigo-500" : "bg-zinc-700"
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">

          {/* Step 1: Person */}
          {step === "person" && (
            <div className="space-y-3">
              <input
                autoFocus
                type="search"
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Actor name..."
                className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="space-y-2">
                {personResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPerson(p); setStep("show"); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition text-left"
                  >
                    {p.profile_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${IMG}${p.profile_path}`} alt={p.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-zinc-400 text-xs">?</div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-zinc-500">{p.known_for_department}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Show */}
          {step === "show" && (
            <div className="space-y-3">
              <button onClick={() => setStep("person")} className="flex items-center gap-1.5 text-zinc-400 text-sm hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <input
                autoFocus
                type="search"
                value={showQuery}
                onChange={(e) => setShowQuery(e.target.value)}
                placeholder="Show or movie name..."
                className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="space-y-2">
                {showResults.map((s) => {
                  const name = s.name ?? s.title ?? "Unknown";
                  const year = (s.first_air_date ?? s.release_date ?? "").slice(0, 4);
                  return (
                    <button
                      key={`${s.media_type}-${s.id}`}
                      onClick={() => selectShow(s)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition text-left"
                    >
                      {s.poster_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${IMG}${s.poster_path}`} alt={name} className="w-10 h-14 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-14 rounded-lg bg-zinc-700 shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{name}</p>
                        <p className="text-xs text-zinc-500">
                          {s.media_type === "tv" ? "TV Show" : "Movie"}{year ? ` · ${year}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Role */}
          {step === "role" && (
            <div className="space-y-4">
              <button onClick={() => setStep("show")} className="flex items-center gap-1.5 text-zinc-400 text-sm hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-zinc-300">Character name</label>
                  {characterLoading && (
                    <span className="text-xs text-indigo-400 flex items-center gap-1">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Looking up...
                    </span>
                  )}
                  {!characterLoading && characterName && (
                    <span className="text-xs text-zinc-500">from TMDB</span>
                  )}
                </div>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Auto-filled from TMDB if available"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-2">Role type</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleType(r)}
                      className={`py-3 rounded-xl text-sm font-medium transition border ${
                        roleType === r
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || characterLoading}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Add to Graph"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
