interface Props { kind: "skull" | "coin" | "heart" | "bolt" | "star" | "shield" | "sword" | "boot" | "dash"; size?: number; className?: string }

const MAPS: Record<Props["kind"], { d: string[]; colors: Record<string, string> }> = {
  skull: {
    d: [".wwww.", "wwwwww", "w.ww.w", "wwwwww", ".w.w.w", ".wwww."],
    colors: { w: "var(--parchment)" },
  },
  coin: {
    d: [".gggg.", "gGGGGg", "gGmmGg", "gGmmGg", "gGGGGg", ".gggg."],
    colors: { g: "var(--wood-2)", G: "var(--fx-gold)", m: "var(--metal-3)" },
  },
  heart: {
    d: [".r.r..", "rrrrr.", "rrrrr.", ".rrr..", "..r...", "......"],
    colors: { r: "var(--fx-red)" },
  },
  bolt: {
    d: ["...b..", "..bb..", ".bbb..", "..bbb.", "...bb.", "...b.."],
    colors: { b: "var(--fx-blue)" },
  },
  star: {
    d: ["..g...", ".ggg..", "ggggg.", ".ggg..", ".g.g..", "......"],
    colors: { g: "var(--fx-gold)" },
  },
  shield: {
    d: ["bbbbb.", "bBBBb.", "bBBBb.", ".bBb..", "..b...", "......"],
    colors: { b: "var(--fx-blue)", B: "var(--metal-3)" },
  },
  sword: {
    d: ["....m.", "...mm.", "..mm..", ".wm...", "ww....", "w....."],
    colors: { m: "var(--metal-3)", w: "var(--wood-2)" },
  },
  boot: {
    d: ["ww....", "ww....", "ww....", "wwww..", "wwwww.", "......"],
    colors: { w: "var(--wood-3)" },
  },
  dash: {
    d: ["g.g.g.", ".g.g.g", "gggggg", ".g.g.g", "g.g.g.", "......"],
    colors: { g: "var(--fx-green)" },
  },
};

export function PixelIcon({ kind, size = 18, className }: Props) {
  const map = MAPS[kind];
  const cell = size / 6;
  return (
    <span className={className} style={{ display: "inline-block", width: size, height: size, position: "relative" }} aria-hidden>
      {map.d.map((row, y) =>
        row.split("").map((ch, x) =>
          ch === "." ? null : (
            <span
              key={`${x}-${y}`}
              style={{
                position: "absolute",
                left: x * cell,
                top: y * cell,
                width: cell,
                height: cell,
                backgroundColor: map.colors[ch] ?? "var(--parchment)",
              }}
            />
          ),
        ),
      )}
    </span>
  );
}
