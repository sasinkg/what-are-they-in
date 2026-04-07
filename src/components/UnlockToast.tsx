"use client";

import { useEffect, useState } from "react";

type Entry = {
  personName: string;
  personPhoto: string | null;
  showName: string;
  characterName: string | null;
  roleType: string;
};

export default function UnlockToast({ entry, onDone }: { entry: Entry | null; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400);
    }, 2200);
    return () => clearTimeout(t);
  }, [entry]);

  if (!entry) return null;

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center pointer-events-none transition-opacity duration-400 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Backdrop blur spot */}
      <div
        className={`flex flex-col items-center gap-3 transition-all duration-500 ${
          visible ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        {/* Glow ring + photo */}
        <div className="relative flex items-center justify-center">
          {/* Outer glow pulse */}
          <div
            className="absolute w-28 h-28 rounded-full animate-ping"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)" }}
          />
          <div
            className="absolute w-24 h-24 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)" }}
          />
          {/* Photo */}
          <div className="w-20 h-20 rounded-full border-2 border-indigo-400 overflow-hidden relative shadow-lg shadow-indigo-500/40">
            {entry.personPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.personPhoto}
                alt={entry.personName}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-2xl">?</div>
            )}
          </div>
          {/* Sparkles */}
          <span className="absolute -top-1 -right-1 text-yellow-300 text-sm animate-bounce">✦</span>
          <span className="absolute -bottom-1 -left-1 text-indigo-300 text-xs" style={{ animationDelay: "0.2s" }}>✦</span>
        </div>

        {/* Text card */}
        <div className="bg-zinc-900/90 backdrop-blur-md border border-indigo-500/30 rounded-2xl px-5 py-3 text-center shadow-xl shadow-indigo-500/10">
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-0.5">Added to graph</p>
          <p className="text-white font-bold text-lg leading-tight">{entry.personName}</p>
          {entry.characterName && (
            <p className="text-zinc-400 text-sm mt-0.5">as {entry.characterName}</p>
          )}
          <p className="text-zinc-500 text-xs mt-1">{entry.showName}</p>
        </div>
      </div>
    </div>
  );
}
