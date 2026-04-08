"use client";

import { useEffect, useState } from "react";

// Bump this string whenever you want to re-show the modal to existing users
const CURRENT_VERSION = "2025-04-07-cast-browser";

const CHANGES = [
  {
    title: "Browse a show's full cast",
    desc: 'Tap any show node → type a character name or actor name in the search box → tap + to add them directly to your graph. No more needing to know the actor\'s name first.',
    icon: "🎭",
  },
  {
    title: "Search by character name",
    desc: "The main search bar now matches character names too - so searching 'Harvey Specter' highlights Gabriel Macht and Suits.",
    icon: "🔍",
  },
  {
    title: "Unlock animation",
    desc: "Adding someone triggers a game-style unlock toast with their photo and role — plus the graph zooms to the new node and animates the connection line in.",
    icon: "✨",
  },
  {
    title: "Auto-complete connections",
    desc: "The ⚡ button checks every actor on your board against every show and fills in any missing connections automatically.",
    icon: "⚡",
  },
];

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("whatsNewSeen");
    if (seen !== CURRENT_VERSION) {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("whatsNewSeen", CURRENT_VERSION);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative bg-zinc-900 rounded-t-3xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        <div className="px-5 pb-6 overflow-y-auto">
          <div className="flex items-center gap-2 mt-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
              What&apos;s New
            </span>
          </div>
          <h2 className="text-xl font-bold mb-5">Recent updates</h2>

          <div className="space-y-4 mb-6">
            {CHANGES.map((c) => (
              <div key={c.title} className="flex gap-3">
                <span className="text-xl shrink-0 mt-0.5">{c.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{c.title}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={dismiss}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
