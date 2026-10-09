"use client";

import { useEffect, useRef, useState } from "react";


const OPENTYPE_CDN = "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js";

const DEFAULT_FONT_URL =
  "https://cdn.21st.dev/assets/mirror/13/1347863151acdc00fa281daaba1a3543dbce5870b55f9cf7479a15bb84007681.ttf";

export interface HandwritingTextProps {
  text?: string;
  words?: string[];
  interval?: number;
  fontUrl?: string;
  duration?: number;
  delay?: number;
  strokeWidth?: number;
  fill?: boolean;
  height?: string;
  className?: string;
  accent?: string;
  accentClassName?: string;
}

type Geometry = {
  full: string;
  contours: string[];
  accented: boolean[];
  fills: { d: string; accented: boolean }[];
  x: number;
  y: number;
  w: number;
  h: number;
};

let libPromise: Promise<any> | null = null;

function loadOpentype(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const existing = (window as any).opentype;
  if (existing) return Promise.resolve(existing);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = OPENTYPE_CDN;
      script.async = true;
      script.onload = () => {
        const lib = (window as any).opentype;
        if (lib) resolve(lib);
        else reject(new Error("opentype.js loaded but exposed nothing"));
      };
      script.onerror = () => reject(new Error("opentype.js failed to load"));
      document.head.appendChild(script);
    });
  }
  return libPromise;
}

const fontCache = new Map<string, Promise<any>>();

function loadFont(url: string): Promise<any> {
  let pending = fontCache.get(url);
  if (!pending) {
    pending = Promise.all([
      loadOpentype(),
      fetch(url).then((res) => {
        if (!res.ok) throw new Error(`Font request failed: ${res.status}`);
        return res.arrayBuffer();
      }),
    ]).then(([lib, buffer]) => lib.parse(buffer));
    fontCache.set(url, pending);
  }
  return pending;
}

const EM = 100;

export function HandwritingText({
  text,
  words,
  interval = 3200,
  fontUrl = DEFAULT_FONT_URL,
  duration = 1.5,
  delay = 0.05,
  strokeWidth = 1.6,
  fill = true,
  height = "1.15em",
  className,
  accent,
  accentClassName,
}: HandwritingTextProps) {
  const cycle = Boolean(words && words.length > 0);
  const [index, setIndex] = useState(0);
  const current = cycle ? words![index % words!.length] : text ?? "";

  const [font, setFont] = useState<any>(null);
  const [geom, setGeom] = useState<Geometry | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [lengths, setLengths] = useState<number[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (!cycle) return undefined;
    const id = setInterval(() => setIndex((i) => i + 1), interval);
    return () => clearInterval(id);
  }, [cycle, interval]);

  useEffect(() => {
    let cancelled = false;
    loadFont(fontUrl)
      .then((f) => { if (!cancelled) setFont(f); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [fontUrl]);

  useEffect(() => {
    if (!font || !current) return;
    const path = font.getPath(current, 0, EM, EM);
    const box = path.getBoundingBox();
    const pad = EM * 0.12;
    const full = path.toPathData(2);
    const split = (d: string): string[] =>
      d.split(/(?=M)/).filter((part: string) => part.trim().length > 1);
    const contours = split(full);

    const accented: boolean[] = [];
    const fills: { d: string; accented: boolean }[] = [];
    const from = accent ? current.indexOf(accent) : -1;
    if (accent && from >= 0) {
      const glyphs: any[] = font.getPaths(current, 0, EM, EM);
      if (glyphs.length === current.length) {
        glyphs.forEach((glyph, i) => {
          const d: string = glyph.toPathData(2);
          const on = i >= from && i < from + accent.length;
          split(d).forEach(() => accented.push(on));
          const last = fills[fills.length - 1];
          if (last && last.accented === on) last.d += d;
          else fills.push({ d, accented: on });
        });
      }
      if (accented.length !== contours.length) {
        accented.length = 0;
        fills.length = 0;
      }
    }

    setGeom({
      full,
      contours,
      accented,
      fills,
      x: box.x1 - pad,
      y: box.y1 - pad,
      w: box.x2 - box.x1 + pad * 2,
      h: box.y2 - box.y1 + pad * 2,
    });
    setDrawn(false);
    setLengths([]);
  }, [font, current, accent]);

  useEffect(() => {
    if (!geom) return undefined;
    setLengths(
      pathRefs.current
        .slice(0, geom.contours.length)
        .map((el) => (el ? el.getTotalLength() : 0)),
    );
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setDrawn(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [geom]);

  if (!geom) {
    return <span className={className}>{current}</span>;
  }

  const count = Math.max(1, geom.contours.length);

  return (
    <svg
      key={current}
      viewBox={`${geom.x} ${geom.y} ${geom.w} ${geom.h}`}
      role="img"
      aria-label={current}
      className={["inline-block", className].filter(Boolean).join(" ")}
      style={{
        height,
        width: `calc(${height} * ${(geom.w / geom.h).toFixed(4)})`,
        overflow: "visible",
      }}
    >
      {fill &&
        (geom.fills.length > 0 ? geom.fills : [{ d: geom.full, accented: false }]).map(
          (run, i) => (
            <path
              key={`fill-${i}`}
              d={run.d}
              fill="currentColor"
              stroke="none"
              className={run.accented ? accentClassName : undefined}
              style={{
                opacity: drawn ? 1 : 0,
                transition: drawn
                  ? `opacity 0.45s ease-out ${(delay + duration * 0.72).toFixed(3)}s`
                  : "none",
              }}
            />
          ),
        )}
      {geom.contours.map((d, i) => {
        const length = lengths[i] || 0;
        const each = (duration / count) * 2.4;
        const start = delay + (i / count) * duration;
        return (
          <path
            key={i}
            ref={(el) => { pathRefs.current[i] = el; }}
            d={d}
            fill="none"
            stroke="currentColor"
            className={geom.accented[i] ? accentClassName : undefined}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: length || 1,
              strokeDashoffset: drawn ? 0 : length || 1,
              transition: drawn
                ? `stroke-dashoffset ${each.toFixed(3)}s ease-out ${start.toFixed(3)}s`
                : "none",
            }}
          />
        );
      })}
    </svg>
  );
}

export default HandwritingText;
