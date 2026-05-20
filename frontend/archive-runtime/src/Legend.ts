import type { Legend, LegendStop } from "./types";

function colorToCss(color: LegendStop["color"]): string {
  if (typeof color === "string") return color;
  const [r, g, b, a = 255] = color;
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

export function renderLegend(legend: Legend | null | undefined): HTMLElement | null {
  if (!legend) return null;
  const wrap = document.createElement("div");
  wrap.className = "legend";

  if (legend.title) {
    const h = document.createElement("strong");
    h.textContent = legend.title;
    wrap.appendChild(h);
  }

  if (legend.kind === "categorical") {
    const ul = document.createElement("ul");
    for (const s of legend.stops) {
      const li = document.createElement("li");
      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = colorToCss(s.color);
      li.appendChild(sw);
      const label = document.createElement("span");
      label.textContent = s.label ?? (s.value !== undefined ? String(s.value) : "");
      li.appendChild(label);
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
  } else {
    const c = document.createElement("div");
    c.className = "continuous";
    const bar = document.createElement("div");
    bar.className = "bar";
    const colors = legend.stops.map((s) => colorToCss(s.color));
    bar.style.background = `linear-gradient(to right, ${colors.join(", ")})`;
    c.appendChild(bar);

    const labels = document.createElement("div");
    labels.style.display = "flex";
    labels.style.justifyContent = "space-between";
    labels.style.fontSize = "0.8rem";
    const first = legend.stops[0]?.label ?? String(legend.stops[0]?.value ?? "");
    const last =
      legend.stops[legend.stops.length - 1]?.label ??
      String(legend.stops[legend.stops.length - 1]?.value ?? "");
    const a = document.createElement("span");
    a.textContent = first;
    const b = document.createElement("span");
    b.textContent = last;
    labels.appendChild(a);
    labels.appendChild(b);
    c.appendChild(labels);

    wrap.appendChild(c);
  }
  return wrap;
}
