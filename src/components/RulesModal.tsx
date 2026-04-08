"use client";

const ROLE_COLORS: Record<string, string> = {
  MAIN: "#6366f1",
  RECURRING: "#22d3ee",
  GUEST: "#f59e0b",
  CAMEO: "#a78bfa",
};

export default function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 rounded-t-3xl w-full max-h-[85vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        <div className="px-5 pb-5 overflow-y-auto">
          <h2 className="text-xl font-bold mb-1 mt-2">How It Works</h2>
          <p className="text-zinc-400 text-sm mb-6">
            What Are They In? is your personal actor connection graph. Every time you recognize someone from another show, add them — and watch the web of connections grow.
          </p>

          {/* Nodes */}
          <Section title="The Graph">
            <Row
              left={<Circle color="#22d3ee" />}
              label="Actor / Person"
              desc="Each person you add gets their own node with their photo."
            />
            <Row
              left={<Rect />}
              label="Show or Movie"
              desc="Shows appear as poster thumbnails. They connect to every actor in them."
            />
            <Row
              left={<Line color="#6366f1" />}
              label="Connection"
              desc="A line between an actor and a show means they appeared in it. The color tells you the role type."
            />
          </Section>

          {/* Role types */}
          <Section title="Role Types">
            {Object.entries(ROLE_COLORS).map(([role, color]) => (
              <Row
                key={role}
                left={<Line color={color} />}
                label={role.charAt(0) + role.slice(1).toLowerCase()}
                desc={ROLE_DESCS[role]}
              />
            ))}
          </Section>

          {/* Buttons */}
          <Section title="Buttons">
            <Row
              left={<Icon>⚡</Icon>}
              label="Auto-complete"
              desc="Checks every actor on your board against every show on your board and fills in any missing connections automatically using TMDB data."
            />
            <Row
              left={<Icon>🗑</Icon>}
              label="Clear Board"
              desc="Removes everything. Use with caution — this can't be undone."
            />
            <Row
              left={<Icon>+</Icon>}
              label="Add Entry"
              desc="Search for an actor, pick a show they appeared in, and add the connection."
            />
          </Section>

          {/* Search */}
          <Section title="Search & Highlight">
            <p className="text-zinc-400 text-sm">
              Type any actor name, show name, or character name in the search bar. Matching nodes light up and everything else fades — great for tracing how people are connected.
            </p>
            <p className="text-zinc-400 text-sm mt-2">
              Tap any node to highlight all its connections and see details below the graph.
            </p>
          </Section>

          <button
            onClick={onClose}
            className="w-full mt-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

const ROLE_DESCS: Record<string, string> = {
  MAIN: "Series regular. In most or all episodes, top of the billing.",
  RECURRING: "Appears in multiple episodes across one or more seasons.",
  GUEST: "One-off or limited appearance, credited role.",
  CAMEO: "Brief appearance, often uncredited or a fun surprise.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500 font-medium mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ left, label, desc }: { left: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 flex items-center justify-center shrink-0 mt-0.5">{left}</div>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function Circle({ color }: { color: string }) {
  return <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: color, background: "#164e63" }} />;
}

function Rect() {
  return <div className="w-4 h-6 rounded border-2 border-indigo-500" style={{ background: "#1e1b4b" }} />;
}

function Line({ color }: { color: string }) {
  return (
    <div className="w-8 h-0.5 rounded-full" style={{ background: color }} />
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="text-base">{children}</span>;
}
