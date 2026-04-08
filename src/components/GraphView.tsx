"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { ForceGraphMethods } from "react-force-graph-2d";
import AddEntrySheet from "./AddEntrySheet";
import ConfirmDialog from "./ConfirmDialog";
import UnlockToast from "./UnlockToast";
import RulesModal from "./RulesModal";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

type Entry = {
  id: string;
  tmdbPersonId: number;
  personName: string;
  personPhoto: string | null;
  tmdbShowId: number;
  showName: string;
  showPoster: string | null;
  showType: string;
  characterName: string | null;
  roleType: string;
};

type GraphNode = {
  id: string;
  name: string;
  type: "person" | "show";
  photo?: string | null;
  showType?: string;
  val?: number;
  x?: number;
  y?: number;
};

type CastMember = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
  episodeCount?: number;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  roleType: string;
  characterName?: string | null;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

const ROLE_COLORS: Record<string, string> = {
  MAIN: "#6366f1",
  RECURRING: "#22d3ee",
  GUEST: "#f59e0b",
  CAMEO: "#a78bfa",
};

function buildGraph(entries: Entry[]): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  for (const entry of entries) {
    const personKey = `person-${entry.tmdbPersonId}`;
    const showKey = `show-${entry.tmdbShowId}`;

    if (!nodeMap.has(personKey)) {
      nodeMap.set(personKey, {
        id: personKey,
        name: entry.personName,
        type: "person",
        photo: entry.personPhoto,
        val: 2,
      });
    }

    if (!nodeMap.has(showKey)) {
      nodeMap.set(showKey, {
        id: showKey,
        name: entry.showName,
        type: "show",
        photo: entry.showPoster,
        showType: entry.showType,
        val: 8,
      });
    }

    links.push({
      source: personKey,
      target: showKey,
      roleType: entry.roleType,
      characterName: entry.characterName,
    });
  }

  return { nodes: Array.from(nodeMap.values()), links };
}

// Image cache — "loading" sentinel prevents duplicate requests across render frames
const imgCache = new Map<string, HTMLImageElement | "loading">();

// Route TMDB images through our proxy to avoid CORS issues on canvas
function proxyUrl(url: string) {
  return `/api/tmdb/image?url=${encodeURIComponent(url)}`;
}

function loadImage(url: string, onLoad: () => void): HTMLImageElement | null {
  const cached = imgCache.get(url);
  if (cached === "loading") return null;
  if (cached) return cached;

  imgCache.set(url, "loading");
  const img = new Image();
  img.onload = () => {
    imgCache.set(url, img);
    onLoad();
  };
  img.onerror = () => {
    imgCache.delete(url);
  };
  img.src = proxyUrl(url);
  return null;
}

export default function GraphView({ userName }: { userName: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [autoResults, setAutoResults] = useState<Entry[] | null>(null);
  const [autoMessage, setAutoMessage] = useState("");
  const [confirmAutoComplete, setConfirmAutoComplete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [boardStatus, setBoardStatus] = useState<"unknown" | "complete" | "pending">("unknown");
  const [unlockEntry, setUnlockEntry] = useState<Entry | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [panelSearch, setPanelSearch] = useState("");
  const [tmdbCast, setTmdbCast] = useState<CastMember[]>([]);
  const [castLoading, setCastLoading] = useState(false);
  const [addingCastId, setAddingCastId] = useState<number | null>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode>>(undefined);
  const graphDataRef = useRef<GraphData>({ nodes: [], links: [] });
  const newLinksRef = useRef<Map<string, number>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const LINK_ANIM_MS = 700;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 600 });
  const [imgTick, setImgTick] = useState(0);

  async function refreshStatus() {
    if (entries.length === 0) { setBoardStatus("unknown"); return; }
    const res = await fetch("/api/entries/status");
    const data = await res.json();
    setBoardStatus(data.complete ? "complete" : "pending");
  }

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data: Entry[]) => {
        setEntries(data);
        setGraphData(buildGraph(data));
        if (data.length > 0) {
          fetch("/api/entries/status")
            .then((r) => r.json())
            .then((s) => setBoardStatus(s.complete ? "complete" : "pending"));
        }
      });
  }, []);

  useEffect(() => { graphDataRef.current = graphData; }, [graphData]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Recalculate graph dimensions when panel opens/closes
  useEffect(() => {
    setTimeout(() => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }, 0);
  }, [selectedNode]);

  useEffect(() => {
    if (!search.trim()) {
      setHighlightIds(new Set());
      return;
    }
    // Clear node selection when typing
    setSelectedNode(null);
    const q = search.toLowerCase();
    const matched = new Set<string>();

    // Match node names (actors + shows)
    graphData.nodes.forEach((n) => {
      if (n.name.toLowerCase().includes(q)) matched.add(n.id);
    });

    // Match character names — highlight both the actor and show nodes
    entries.forEach((e) => {
      if (e.characterName?.toLowerCase().includes(q)) {
        matched.add(`person-${e.tmdbPersonId}`);
        matched.add(`show-${e.tmdbShowId}`);
      }
    });

    // Expand to connected nodes
    graphData.links.forEach((l) => {
      const src = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
      const tgt = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
      if (matched.has(src)) matched.add(tgt);
      if (matched.has(tgt)) matched.add(src);
    });
    setHighlightIds(matched);
  }, [search, graphData, entries]);

  // Fetch TMDB cast when a show node is selected
  useEffect(() => {
    if (!selectedNode || selectedNode.type !== "show") {
      setTmdbCast([]);
      return;
    }
    const showId = selectedNode.id.replace("show-", "");
    const showType = selectedNode.showType ?? "tv";
    setCastLoading(true);
    fetch(`/api/tmdb/show/${showId}/credits?type=${showType}`)
      .then((r) => r.json())
      .then((data) => setTmdbCast(data.cast ?? []))
      .catch(() => setTmdbCast([]))
      .finally(() => setCastLoading(false));
  }, [selectedNode?.id]);

  const IMG_BASE = "https://image.tmdb.org/t/p/w92";

  function detectRoleFromCast(c: CastMember, showType: string): string {
    if (showType === "movie") {
      if (c.order < 5) return "MAIN";
      if (c.order < 20) return "GUEST";
      return "CAMEO";
    }
    const eps = c.episodeCount ?? 0;
    if (eps >= 20) return "MAIN";
    if (eps >= 4) return "RECURRING";
    if (eps >= 2) return "GUEST";
    return c.order < 15 ? "GUEST" : "CAMEO";
  }

  async function handleAddFromCast(cast: CastMember) {
    if (!selectedNode || selectedNode.type !== "show") return;
    setAddingCastId(cast.id);
    const showId = parseInt(selectedNode.id.replace("show-", ""), 10);
    const showName = selectedNode.name;
    const showPoster = selectedNode.photo ?? null;
    const showType = selectedNode.showType ?? "tv";
    const roleType = detectRoleFromCast(cast, showType);

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbPersonId: cast.id,
          personName: cast.name,
          personPhoto: cast.profilePath ? `${IMG_BASE}${cast.profilePath}` : null,
          tmdbShowId: showId,
          showName,
          showPoster,
          showType,
          characterName: cast.character.trim() || null,
          roleType,
        }),
      });
      if (res.ok) {
        const entry = await res.json();
        onEntryAdded(entry);
      }
    } finally {
      setAddingCastId(null);
    }
  }

  function startLinkAnimation() {
    if (animFrameRef.current) return;
    function tick() {
      const now = Date.now();
      for (const [id, start] of newLinksRef.current) {
        if (now - start > LINK_ANIM_MS) newLinksRef.current.delete(id);
      }
      setImgTick((n) => n + 1);
      if (newLinksRef.current.size > 0) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
      }
    }
    animFrameRef.current = requestAnimationFrame(tick);
  }

  function onEntryAdded(entry: Entry) {
    setEntries((prev) => {
      const updated = [...prev, entry];
      setGraphData(buildGraph(updated));
      return updated;
    });
    setBoardStatus("unknown");
    setTimeout(refreshStatus, 500);

    // Show unlock toast
    setUnlockEntry(entry);

    // Register new link for draw animation
    newLinksRef.current.set(
      `person-${entry.tmdbPersonId}-show-${entry.tmdbShowId}`,
      Date.now()
    );
    startLinkAnimation();

    // Zoom into the new person node, then zoom back out
    const newNodeId = `person-${entry.tmdbPersonId}`;
    setTimeout(() => {
      const g = graphRef.current;
      if (!g) return;
      // react-force-graph mutates node objects with x/y in place
      const node = graphDataRef.current.nodes.find((n) => n.id === newNodeId);
      if (node?.x !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (g as any).centerAt(node.x, node.y, 600);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (g as any).zoom(6, 600);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTimeout(() => (g as any).zoomToFit(700, 60), 2400);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (g as any).zoomToFit(700, 60);
      }
    }, 900);
  }

  async function handleAutoComplete() {
    setConfirmAutoComplete(false);
    setAutoCompleting(true);
    setAutoResults(null);
    try {
      const res = await fetch("/api/entries/autocomplete", { method: "POST" });
      const data = await res.json();
      setAutoResults(data.added ?? []);
      setAutoMessage(data.message ?? "");
      const allRes = await fetch("/api/entries");
      const all = await allRes.json();
      setEntries(all);
      setGraphData(buildGraph(all));
      const s = await fetch("/api/entries/status").then((r) => r.json());
      setBoardStatus(s.complete ? "complete" : "pending");
    } finally {
      setAutoCompleting(false);
    }
  }

  async function handleClearBoard() {
    setConfirmClear(false);
    setClearing(true);
    try {
      await fetch("/api/entries", { method: "DELETE" });
      setEntries([]);
      setGraphData({ nodes: [], links: [] });
      setSelectedNode(null);
      setBoardStatus("unknown");
      imgCache.clear();
    } finally {
      setClearing(false);
    }
  }

  const handleNodeClick = useCallback((node: GraphNode) => {
    setPanelSearch("");
    setSelectedNode((prev) => {
      if (prev?.id === node.id) {
        setHighlightIds(new Set());
        return null;
      }
      // Highlight the clicked node + everything directly connected
      const ids = new Set<string>([node.id]);
      graphDataRef.current.links.forEach((l) => {
        const src = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
        const tgt = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
        if (src === node.id) ids.add(tgt);
        if (tgt === node.id) ids.add(src);
      });
      setHighlightIds(ids);
      return node;
    });
  }, []);

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isHighlighted = highlightIds.size === 0 || highlightIds.has(node.id);
      const isSelected = selectedNode?.id === node.id;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const isShow = node.type === "show";

      // Show: small portrait rectangle. Actor: circle.
      const pw = isShow ? 7 : 0;    // half-width
      const ph = isShow ? 10 : 0;   // half-height (2:3 ratio)
      const cr = isShow ? 2 : 0;    // corner radius
      const r  = isShow ? 0 : 6;    // circle radius for actors

      ctx.globalAlpha = isHighlighted ? 1 : 0.12;

      const photoUrl = node.photo;
      const cached = photoUrl ? imgCache.get(photoUrl) : undefined;
      const img = cached instanceof HTMLImageElement ? cached : null;

      if (photoUrl && !cached) {
        loadImage(photoUrl, () => setImgTick((n) => n + 1));
      }

      function clipShape() {
        ctx.beginPath();
        if (isShow) {
          ctx.roundRect(x - pw, y - ph, pw * 2, ph * 2, cr);
        } else {
          ctx.arc(x, y, r, 0, 2 * Math.PI);
        }
      }

      ctx.save();
      clipShape();
      ctx.clip();
      if (img) {
        if (isShow) {
          // Fit full poster into rectangle
          ctx.drawImage(img, x - pw, y - ph, pw * 2, ph * 2);
        } else {
          // Crop actor photo to top 60% (face area) and fill circle
          const srcH = img.naturalHeight * 0.6;
          ctx.drawImage(img, 0, 0, img.naturalWidth, srcH, x - r, y - r, r * 2, r * 2);
        }
      } else {
        ctx.fillStyle = isShow ? "#1e1b4b" : "#164e63";
        ctx.fill();
      }
      ctx.restore();

      // Border ring
      clipShape();
      ctx.strokeStyle = isSelected ? "#ffffff" : isShow ? "#6366f1" : "#22d3ee";
      ctx.lineWidth = isSelected ? 2.5 / globalScale : 1.5 / globalScale;
      ctx.stroke();

      // Label below node
      const fontSize = Math.max(3, 9 / globalScale);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = isHighlighted ? "#ffffff" : "#555";
      ctx.globalAlpha = isHighlighted ? 1 : 0.12;
      ctx.fillText(node.name, x, y + (isShow ? ph : r) + 2 / globalScale);

      ctx.globalAlpha = 1;
    },
    [highlightIds, selectedNode, imgTick]
  );


  const linkCanvasObject = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      const srcNode = link.source as GraphNode;
      const tgtNode = link.target as GraphNode;
      if (!srcNode?.x || !tgtNode?.x) return;

      const srcId = srcNode.id ?? "";
      const tgtId = tgtNode.id ?? "";
      const highlighted =
        highlightIds.size === 0 || (highlightIds.has(srcId) && highlightIds.has(tgtId));
      const baseColor = highlighted ? (ROLE_COLORS[link.roleType] ?? "#6366f1") : "#2a2a2a";

      // Check for draw animation
      const animKey = `${srcId}-${tgtId}`;
      const startTime = newLinksRef.current.get(animKey);
      let progress = 1;
      if (startTime !== undefined) {
        progress = Math.min((Date.now() - startTime) / LINK_ANIM_MS, 1);
        // ease out
        progress = 1 - Math.pow(1 - progress, 3);
      }

      const sx = srcNode.x ?? 0, sy = srcNode.y ?? 0;
      const tx = tgtNode.x ?? 0, ty = tgtNode.y ?? 0;
      const ex = sx + (tx - sx) * progress;
      const ey = sy + (ty - sy) * progress;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = startTime !== undefined && progress < 1 ? 2.5 : 1.5;

      if (startTime !== undefined && progress < 1) {
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlightIds, imgTick]
  );

  const connectedEntries = selectedNode
    ? entries.filter((e) =>
        selectedNode.type === "person"
          ? `person-${e.tmdbPersonId}` === selectedNode.id
          : `show-${e.tmdbShowId}` === selectedNode.id
      )
    : [];

  return (
    <div className="flex flex-col bg-zinc-950 overflow-hidden" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-zinc-800 shrink-0">
        <button
          onClick={() => setRulesOpen(true)}
          className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center transition shrink-0 text-zinc-400 hover:text-white text-sm font-bold"
          title="How it works"
        >
          ?
        </button>
        <div className="flex-1">
          <p className="text-xs text-zinc-500">Hey, {userName}</p>
          <h1 className="text-lg font-bold leading-tight">What Are They In?</h1>
        </div>
        <button
          onClick={() => setConfirmClear(true)}
          disabled={clearing || entries.length === 0}
          title="Clear board"
          className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center transition disabled:opacity-40 shrink-0"
        >
          {clearing ? (
            <svg className="w-4 h-4 animate-spin text-red-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
        <button
          onClick={() => setConfirmAutoComplete(true)}
          disabled={autoCompleting || entries.length === 0}
          title={boardStatus === "pending" ? "Connections missing — tap to auto-complete" : "Auto-complete connections"}
          className="relative w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center transition disabled:opacity-40 shrink-0"
        >
          {autoCompleting ? (
            <svg className="w-4 h-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
          {/* Status dot */}
          {boardStatus !== "unknown" && !autoCompleting && (
            <span
              className={`absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${
                boardStatus === "complete" ? "bg-green-400" : "bg-orange-400"
              }`}
            />
          )}
        </button>
        <button
          onClick={() => setAddOpen(true)}
          className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </header>

      {/* Search */}
      <div className="px-4 py-2 shrink-0">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actor or show to highlight..."
          className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 pb-2 shrink-0">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <div key={role} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs text-zinc-500 capitalize">{role.toLowerCase()}</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-3">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
              </svg>
            </div>
            <p className="text-zinc-400 text-sm">Tap + to add your first actor</p>
          </div>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <ForceGraph2D
            ref={graphRef as any}
            graphData={graphData as any}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#09090b"
            nodeCanvasObject={nodeCanvasObject as any}
            nodeCanvasObjectMode={() => "replace"}
            linkCanvasObject={linkCanvasObject as any}
            linkCanvasObjectMode={() => "replace"}
            onNodeClick={handleNodeClick as any}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            onEngineStop={() => graphRef.current?.zoomToFit(400, 60)}
            cooldownTicks={100}
          />
        )}
      </div>

      {/* Selected node detail panel */}
      {selectedNode && (
        <div className="shrink-0 bg-zinc-900 border-t border-zinc-800 flex flex-col max-h-64">
          {/* Panel header */}
          <div className="flex items-start justify-between px-4 pt-3 pb-2 shrink-0">
            <div className="flex items-center gap-3">
              {selectedNode.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedNode.photo}
                  alt={selectedNode.name}
                  className={`object-cover shrink-0 ${
                    selectedNode.type === "show" ? "w-8 h-12 rounded-md" : "w-9 h-9 rounded-full object-top"
                  }`}
                />
              )}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide">
                  {selectedNode.type === "person" ? "Actor" : "Show"}
                </p>
                <h2 className="font-semibold text-sm leading-tight">{selectedNode.name}</h2>
              </div>
            </div>
            <button
              onClick={() => { setSelectedNode(null); setHighlightIds(new Set()); setPanelSearch(""); }}
              className="text-zinc-500 hover:text-white p-1 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search — for shows: searches TMDB full cast; for actors: filters their shows */}
          <div className="px-4 pb-2 shrink-0">
            <input
              type="search"
              value={panelSearch}
              onChange={(e) => setPanelSearch(e.target.value)}
              placeholder={
                selectedNode.type === "show"
                  ? "Search full cast to add..."
                  : "Filter shows..."
              }
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="overflow-y-auto px-4 pb-3 space-y-2">
            {selectedNode.type === "show" && panelSearch.trim() ? (
              // TMDB full-cast search results
              castLoading ? (
                <div className="flex items-center gap-2 text-zinc-500 text-xs py-2">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Loading cast...
                </div>
              ) : (
                tmdbCast
                  .filter((c) => {
                    const q = panelSearch.toLowerCase();
                    return (
                      c.name.toLowerCase().includes(q) ||
                      c.character.toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 40)
                  .map((c) => {
                    const showId = parseInt(selectedNode.id.replace("show-", ""), 10);
                    const alreadyAdded = entries.some(
                      (e) => e.tmdbPersonId === c.id && e.tmdbShowId === showId
                    );
                    const isAdding = addingCastId === c.id;
                    return (
                      <div key={c.id} className="flex items-center gap-3">
                        {c.profilePath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${IMG_BASE}${c.profilePath}`}
                            alt={c.name}
                            className="w-7 h-7 rounded-full object-cover object-top shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs shrink-0">?</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{c.name}</p>
                          {c.character && (
                            <p className="text-xs text-zinc-500 truncate">as {c.character}</p>
                          )}
                        </div>
                        {alreadyAdded ? (
                          <div className="shrink-0 w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddFromCast(c)}
                            disabled={isAdding}
                            className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition disabled:opacity-50"
                          >
                            {isAdding ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })
              )
            ) : (
              // Existing connected entries (default view)
              connectedEntries
                .filter((e) => {
                  if (!panelSearch.trim()) return true;
                  const q = panelSearch.toLowerCase();
                  return (
                    e.personName.toLowerCase().includes(q) ||
                    e.characterName?.toLowerCase().includes(q) ||
                    e.showName.toLowerCase().includes(q)
                  );
                })
                .map((e) => (
                  <div key={e.id} className="flex items-center gap-3">
                    {selectedNode.type === "person" ? (
                      e.showPoster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.showPoster} alt={e.showName} className="w-6 h-9 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-9 rounded bg-zinc-800 shrink-0" />
                      )
                    ) : e.personPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.personPhoto} alt={e.personName} className="w-7 h-7 rounded-full object-cover object-top shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {selectedNode.type === "person" ? e.showName : e.personName}
                      </p>
                      {e.characterName && (
                        <p className="text-xs text-zinc-500 truncate">as {e.characterName}</p>
                      )}
                    </div>
                    <div
                      className="shrink-0 text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: `${ROLE_COLORS[e.roleType]}22`, color: ROLE_COLORS[e.roleType] }}
                    >
                      {e.roleType.toLowerCase()}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}


      {/* Auto-complete results panel */}
      {autoResults !== null && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAutoResults(null)} />
          <div className="relative bg-zinc-900 rounded-t-3xl w-full max-h-[75vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-700" />
            </div>
            <div className="px-4 pb-3 shrink-0 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Auto-complete</h2>
                <p className="text-zinc-400 text-sm">{autoMessage}</p>
              </div>
              <button onClick={() => setAutoResults(null)} className="text-zinc-500 hover:text-white p-1 mt-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {autoResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <p className="text-zinc-500 text-sm">All connections on your board are already filled in.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
                {autoResults.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800">
                    {e.personPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.personPhoto} alt={e.personName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-zinc-700 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">
                        <span className="text-indigo-300">{e.personName}</span>
                        {" is in "}
                        <span className="text-cyan-300">{e.showName}</span>
                      </p>
                      {e.characterName && (
                        <p className="text-xs text-zinc-400">as {e.characterName}</p>
                      )}
                    </div>
                    {e.showPoster && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.showPoster} alt={e.showName} className="w-7 h-10 rounded object-cover shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add entry sheet */}
      <AddEntrySheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={onEntryAdded}
      />

      <UnlockToast entry={unlockEntry} onDone={() => setUnlockEntry(null)} />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <ConfirmDialog
        open={confirmAutoComplete}
        title="Auto-complete connections?"
        message="This will check every actor on your board against every show on your board and automatically fill in any missing connections using TMDB data."
        confirmLabel="Yes, run it"
        onConfirm={handleAutoComplete}
        onCancel={() => setConfirmAutoComplete(false)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear the board?"
        message="This will permanently delete all your entries. This can't be undone."
        confirmLabel="Clear everything"
        confirmDestructive
        onConfirm={handleClearBoard}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
