import { ImageResponse } from "next/og";

export const alt = "CodeBaseGPT — understand any codebase, with evidence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b1020", color: "#e6eaf2", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 600 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{"</>"}</div>
          CodeBase<span style={{ color: "#818cf8" }}>GPT</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>Understand any codebase.</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, color: "#818cf8" }}>With receipts.</div>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 26, color: "#94a3b8" }}>
          <span>Interactive Codebase Atlas</span>
          <span>·</span>
          <span>Cited Gemma answers</span>
          <span>·</span>
          <span>Student Stuck Mode</span>
        </div>
      </div>
    ),
    size,
  );
}
