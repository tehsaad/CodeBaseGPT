/** Original line-art illustrations for the landing page (isometric, lime accents). Decorative. */

const L = "#c8f135";
const G = "rgba(242,242,238,0.38)";
const D = "rgba(242,242,238,0.14)";

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
    <svg viewBox="0 0 600 380" className="h-full w-full" aria-hidden>
      <g stroke={D} strokeDasharray="2 6">
        {Array.from({ length: 9 }, (_, i) => <line key={`a${i}`} x1={i * 75} y1="0" x2={i * 75 + 200} y2="380" />)}
      </g>
      {edges.map(([a, b], i) => {
        const hot = a === 3 || b === 3;
        return <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={hot ? L : G} strokeWidth={hot ? 1.6 : 1} strokeDasharray={hot ? undefined : "4 4"} />;
      })}
      {nodes.map((n) => (
        <g key={n.label} transform={`translate(${n.x} ${n.y})`}>
          <path d="M0 -26 L46 0 L0 26 L-46 0 Z" fill="#0c0c0c" stroke={n.hot ? L : G} strokeWidth={n.hot ? 1.6 : 1} />
          <path d="M-46 0 L-46 12 L0 38 L46 12 L46 0" fill="none" stroke={n.hot ? L : D} />
          <circle r="3" fill={n.hot ? L : G} cy="-4" />
          <text y="58" textAnchor="middle" fill={n.hot ? L : G} fontFamily="var(--font-geist-mono)" fontSize="11" letterSpacing="1.5">{n.label.toUpperCase()}</text>
        </g>
      ))}
    </svg>
  );
}

export function CitedArt() {
  return (
    <svg viewBox="0 0 480 300" className="h-full w-full" aria-hidden>
      <g transform="translate(60 40)" fill="none">
        <path d="M0 20 L180 -20 L360 20 L180 60 Z" stroke={G} />
        <path d="M0 20 L0 150 L180 190 L180 60" stroke={D} />
        <path d="M360 20 L360 150 L180 190" stroke={D} />
        {[0, 1, 2, 3].map((i) => <line key={i} x1={30} y1={60 + i * 26} x2={150 - i * 12} y2={66 + i * 26} stroke={G} strokeWidth="5" strokeLinecap="round" opacity={0.6 - i * 0.1} />)}
        <rect x="210" y="70" width="40" height="18" rx="4" stroke={L} />
        <text x="230" y="83" textAnchor="middle" fill={L} fontFamily="var(--font-geist-mono)" fontSize="10">C1</text>
        <rect x="260" y="92" width="40" height="18" rx="4" stroke={L} />
        <text x="280" y="105" textAnchor="middle" fill={L} fontFamily="var(--font-geist-mono)" fontSize="10">C2</text>
        <path d="M230 88 L230 132 L120 150" stroke={L} strokeDasharray="3 4" />
        <circle cx="120" cy="150" r="4" fill={L} />
      </g>
    </svg>
  );
}

export function StuckArt() {
  return (
    <svg viewBox="0 0 480 300" className="h-full w-full" aria-hidden>
      <g fill="none">
        <circle cx="240" cy="150" r="54" stroke={L} />
        <circle cx="240" cy="150" r="94" stroke={G} strokeDasharray="3 6" />
        <circle cx="240" cy="150" r="130" stroke={D} />
        {[
          [240, 20, "DOCS"],
          [380, 120, "SO"],
          [110, 220, "REPO"],
          [350, 250, "MDN"],
        ].map(([x, y, t]) => (
          <g key={String(t)}>
            <line x1="240" y1="150" x2={x as number} y2={y as number} stroke={t === "REPO" ? L : G} strokeDasharray="4 4" />
            <rect x={(x as number) - 26} y={(y as number) - 11} width="52" height="22" rx="11" fill="#0c0c0c" stroke={t === "REPO" ? L : G} />
            <text x={x as number} y={(y as number) + 4} textAnchor="middle" fill={t === "REPO" ? L : G} fontFamily="var(--font-geist-mono)" fontSize="9" letterSpacing="1.5">{t}</text>
          </g>
        ))}
        <text x="240" y="156" textAnchor="middle" fill={L} fontFamily="var(--font-geist-mono)" fontSize="13">?</text>
      </g>
    </svg>
  );
}

export function TutorArt() {
  return (
    <svg viewBox="0 0 600 300" className="h-full w-full" aria-hidden>
      <g transform="translate(70 30)" fill="none">
        <rect width="300" height="200" rx="10" stroke={G} />
        <line x1="0" y1="26" x2="300" y2="26" stroke={D} />
        {[0, 1, 2].map((i) => <circle key={i} cx={16 + i * 14} cy="13" r="3.5" stroke={G} />)}
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <text x="14" y={56 + i * 26} fill={D} fontFamily="var(--font-geist-mono)" fontSize="10">{i + 1}</text>
            <line x1="34" y1={52 + i * 26} x2={120 + ((i * 53) % 130)} y2={52 + i * 26} stroke={i === 3 ? L : G} strokeWidth="5" strokeLinecap="round" opacity={i === 3 ? 1 : 0.5} />
          </g>
        ))}
        <rect x="26" y="122" width="262" height="20" rx="3" stroke={L} strokeDasharray="3 3" />
        <path d="M300 132 L360 132 L360 60 L440 60" stroke={L} />
        <rect x="380" y="20" width="110" height="80" rx="8" fill="#0c0c0c" stroke={L} />
        <text x="435" y="48" textAnchor="middle" fill={L} fontFamily="var(--font-geist-mono)" fontSize="10" letterSpacing="1.5">LINE 4</text>
        <line x1="396" y1="64" x2="474" y2="64" stroke={G} strokeWidth="4" strokeLinecap="round" />
        <line x1="396" y1="78" x2="452" y2="78" stroke={G} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      </g>
    </svg>
  );
}
