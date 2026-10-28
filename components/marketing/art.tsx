/**
 * Original line-art illustrations for the landing page (isometric, lime accents). Decorative.
 * Motion classes (svg-dash, svg-pulse, svg-float, svg-spin, svg-blink, svg-draw, sep) are defined in globals.css.
 */
import type { CSSProperties } from "react";

const L = "#c8f135";
const G = "rgba(242,242,238,0.38)";
const D = "rgba(242,242,238,0.14)";
const mono = { fontFamily: "var(--font-geist-mono)" } as const;
const v = (vars: Record<string, string | number>) => vars as CSSProperties;

export function AtlasArt() {
  const nodes = [
    { x: 300, y: 70, label: "api/" },
    { x: 150, y: 150, label: "auth/" },
    { x: 450, y: 150, label: "db.ts" },
    { x: 300, y: 230, label: "session.ts", hot: true },
    { x: 150, y: 310, label: "password.ts" },
    { x: 450, y: 310, label: "jobs/" },
  ];
  const edges = [[0, 3], [1, 3], [3, 2], [3, 4], [5, 2], [0, 1]];
  return (
    <svg viewBox="0 0 600 380" className="h-full w-full overflow-visible" aria-hidden>
      <g stroke={D} strokeDasharray="2 6">
        {Array.from({ length: 9 }, (_, i) => <line key={`a${i}`} x1={i * 75} y1="0" x2={i * 75 + 200} y2="380" />)}
      </g>
      {edges.map(([a, b], i) => {
        const hot = a === 3 || b === 3;
        return <line key={i} className={hot ? "svg-dash" : "svg-spray"} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={hot ? L : G} strokeWidth={hot ? 1.6 : 1} />;
      })}
      {nodes.map((n, i) => (
        <g key={n.label} className="sep" style={v({ "--i": i, "--sep-from": `${18 + i * 3}px` })}>
          <g transform={`translate(${n.x} ${n.y})`}>
            <g className="svg-float" style={v({ "--fd": `${i * 0.6}s` })}>
              <path d="M0 -26 L46 0 L0 26 L-46 0 Z" fill="#0c0c0c" stroke={n.hot ? L : G} strokeWidth={n.hot ? 1.6 : 1} />
              <path d="M-46 0 L-46 12 L0 38 L46 12 L46 0" fill="none" stroke={n.hot ? L : D} />
              {n.hot ? <circle className="svg-pulse" r="4" cy="-4" fill="none" stroke={L} /> : null}
              <circle r="3" fill={n.hot ? L : G} cy="-4" className={n.hot ? undefined : "svg-blink"} style={v({ animationDelay: `${i * 0.4}s` })} />
            </g>
            <text y="58" textAnchor="middle" fill={n.hot ? L : G} fontSize="11" letterSpacing="1.5" style={mono}>{n.label.toUpperCase()}</text>
          </g>
        </g>
      ))}
    </svg>
  );
}

export function CitedArt() {
  return (
    <svg viewBox="0 0 480 300" className="h-full w-full overflow-visible" aria-hidden>
      <g transform="translate(60 40)" fill="none">
        <g className="sep" style={v({ "--i": 0, "--sep-from": "20px" })}>
          <path d="M0 20 L180 -20 L360 20 L180 60 Z" stroke={G} />
          <path d="M0 20 L0 150 L180 190 L180 60" stroke={D} />
          <path d="M360 20 L360 150 L180 190" stroke={D} />
          {[0, 1, 2, 3].map((i) => <line key={i} x1={30} y1={60 + i * 26} x2={150 - i * 12} y2={66 + i * 26} stroke={G} strokeWidth="5" strokeLinecap="round" opacity={0.6 - i * 0.1} />)}
        </g>
        <g className="sep" style={v({ "--i": 2, "--sep-from": "34px" })}>
          <g className="svg-float">
            <rect x="210" y="70" width="40" height="18" rx="4" stroke={L} />
            <text x="230" y="83" textAnchor="middle" fill={L} fontSize="10" style={mono}>C1</text>
          </g>
          <g className="svg-float" style={v({ "--fd": "1.2s" })}>
            <rect x="260" y="92" width="40" height="18" rx="4" stroke={L} />
            <text x="280" y="105" textAnchor="middle" fill={L} fontSize="10" style={mono}>C2</text>
          </g>
        </g>
        <path className="svg-draw" pathLength={1} d="M230 88 L230 132 L120 150" stroke={L} style={v({ "--i": 3 })} />
        <circle cx="120" cy="150" r="4" fill={L} />
        <circle className="svg-pulse" cx="120" cy="150" r="4" stroke={L} />
      </g>
    </svg>
  );
}

export function StuckArt() {
  const sources: [number, number, string][] = [
    [240, 20, "DOCS"],
    [380, 120, "SO"],
    [110, 220, "REPO"],
    [350, 250, "MDN"],
  ];
  return (
    <svg viewBox="0 0 480 300" className="h-full w-full overflow-visible" aria-hidden>
      <g fill="none">
        <circle cx="240" cy="150" r="54" stroke={L} />
        <circle className="svg-spin" cx="240" cy="150" r="94" stroke={G} strokeDasharray="3 6" />
        <circle className="svg-spin-slow" cx="240" cy="150" r="130" stroke={D} strokeDasharray="1 10" />
        <circle className="svg-pulse" cx="240" cy="150" r="10" stroke={L} />
        {sources.map(([x, y, t], i) => (
          <g key={t} className="sep" style={v({ "--i": i, "--sep-from": "16px" })}>
            <line className={t === "REPO" ? "svg-dash" : "svg-spray"} x1="240" y1="150" x2={x} y2={y} stroke={t === "REPO" ? L : G} />
            <g className="svg-float" style={v({ "--fd": `${i * 0.8}s` })}>
              <rect x={x - 26} y={y - 11} width="52" height="22" rx="11" fill="#0c0c0c" stroke={t === "REPO" ? L : G} />
              <text x={x} y={y + 4} textAnchor="middle" fill={t === "REPO" ? L : G} fontSize="9" letterSpacing="1.5" style={mono}>{t}</text>
            </g>
          </g>
        ))}
        <text x="240" y="156" textAnchor="middle" fill={L} fontSize="13" style={mono}>?</text>
      </g>
    </svg>
  );
}

export function TutorArt() {
  return (
    <svg viewBox="0 0 600 300" className="h-full w-full overflow-visible" aria-hidden>
      <g transform="translate(70 30)" fill="none">
        <g className="sep" style={v({ "--i": 0, "--sep-from": "18px" })}>
          <rect width="300" height="200" rx="10" fill="#0c0c0c" stroke={G} />
          <line x1="0" y1="26" x2="300" y2="26" stroke={D} />
          {[0, 1, 2].map((i) => <circle key={i} cx={16 + i * 14} cy="13" r="3.5" stroke={G} />)}
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <text x="14" y={56 + i * 26} fill={D} fontSize="10" style={mono}>{i + 1}</text>
              <line x1="34" y1={52 + i * 26} x2={120 + ((i * 53) % 130)} y2={52 + i * 26} stroke={i === 3 ? L : G} strokeWidth="5" strokeLinecap="round" opacity={i === 3 ? 1 : 0.5} />
            </g>
          ))}
          <rect className="svg-blink" x="26" y="122" width="262" height="20" rx="3" stroke={L} strokeDasharray="3 3" />
          <rect className="svg-blink" x={130 + 6} y="124" width="6" height="16" fill={L} style={v({ animationDuration: "1.1s" })} />
        </g>
        <path className="svg-draw" pathLength={1} d="M300 132 L360 132 L360 60 L380 60" stroke={L} style={v({ "--i": 2 })} />
        <g className="sep" style={v({ "--i": 3, "--sep-from": "30px" })}>
          <g className="svg-float" style={v({ "--fd": "0.8s" })}>
            <rect x="380" y="20" width="110" height="80" rx="8" fill="#0c0c0c" stroke={L} />
            <text x="435" y="48" textAnchor="middle" fill={L} fontSize="10" letterSpacing="1.5" style={mono}>LINE 4</text>
            <line x1="396" y1="64" x2="474" y2="64" stroke={G} strokeWidth="4" strokeLinecap="round" />
            <line x1="396" y1="78" x2="452" y2="78" stroke={G} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Small animated bar chart for the Insights showcase (decorative, labelled as sample on the page). */
export function BarsArt() {
  const bars = [62, 88, 40, 74, 30, 96, 52];
  return (
    <svg viewBox="0 0 420 240" className="h-full w-full" aria-hidden>
      <g stroke={D}>
        {[0, 1, 2, 3].map((i) => <line key={i} x1="20" x2="400" y1={40 + i * 50} y2={40 + i * 50} strokeDasharray="2 6" />)}
      </g>
      {bars.map((h, i) => (
        <rect key={i} className="bar" style={v({ "--i": i })} x={40 + i * 52} y={190 - h * 1.5} width="28" height={h * 1.5} rx="3" fill={i === 5 ? L : "rgba(242,242,238,0.16)"} stroke={i === 5 ? L : G} />
      ))}
      <line x1="20" x2="400" y1="190" y2="190" stroke={G} />
    </svg>
  );
}
