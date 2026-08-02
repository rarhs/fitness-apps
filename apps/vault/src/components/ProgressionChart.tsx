import { useLayoutEffect, useRef, useState } from 'react';
import { formatDay } from '../lib';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

export interface ChartPoint {
  date: string;
  value: number;
  /** One-line set summary for the tooltip and the data table. */
  detail: string;
}

/** Container width via ResizeObserver, so the SVG renders in real pixels
 * (a scaled viewBox would distort markers and text). */
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** ~4 clean-numbered ticks spanning [min, max]; the domain snaps to them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min = min === 0 ? 0 : min - Math.abs(min) * 0.1;
    max = max === 0 ? 1 : max + Math.abs(max) * 0.1;
  }
  const span = max - min;
  const mag = 10 ** Math.floor(Math.log10(span / count));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step / 2; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

const fmtVal = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });

const PAD = { top: 16, right: 18, bottom: 26, left: 46 };
const HEIGHT = 240;

/** Single-series session-by-session line chart in the Nocturne accent, with a
 * crosshair tooltip (pointer and arrow keys) and a data-table fallback. */
export function ProgressionChart({
  points,
  unit,
  valueHeader,
  ariaLabel,
}: {
  points: ChartPoint[];
  /** Display suffix for values — "kg", "lb" or "reps". */
  unit: string;
  /** Column header in the data table, e.g. "Top set (kg)". */
  valueHeader: string;
  ariaLabel: string;
}) {
  const { ref, width } = useMeasuredWidth();
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = points.length;
  if (n < 2) return null;

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const ticks = niceTicks(
    Math.min(...points.map((p) => p.value)),
    Math.max(...points.map((p) => p.value)),
  );
  const [lo, hi] = [ticks[0]!, ticks.at(-1)!];
  const x = (i: number) => PAD.left + (i / (n - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const baseY = PAD.top + plotH;

  // Sparse x labels: every step-th session, and always the last one.
  const step = Math.ceil(n / Math.max(2, Math.floor(plotW / 72)));
  const labelled = points
    .map((_, i) => i)
    .filter((i) => (i % step === 0 && x(n - 1) - x(i) > 48) || i === n - 1);

  const moveTo = (i: number) => setActive(Math.max(0, Math.min(n - 1, i)));
  const nearest = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.round(((clientX - rect.left - PAD.left) / plotW) * (n - 1));
  };

  const a = active !== null ? points[active] : undefined;

  return (
    <div>
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        className="chart-wrap"
        style={{ position: 'relative', outlineOffset: 4 }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') moveTo((active ?? n - 1) - 1);
          else if (e.key === 'ArrowRight') moveTo(active === null ? n - 1 : active + 1);
          else if (e.key === 'Home') moveTo(0);
          else if (e.key === 'End') moveTo(n - 1);
          else return;
          e.preventDefault();
        }}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg
            ref={svgRef}
            width={width}
            height={HEIGHT}
            style={{ display: 'block' }}
            onPointerMove={(e) => moveTo(nearest(e.clientX))}
            onPointerLeave={() => setActive(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === lo ? 'var(--color-divider)' : muted(7)}
                  strokeWidth={1}
                />
                <text x={PAD.left - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill={muted(42)}>
                  {fmtVal(t)}
                </text>
              </g>
            ))}
            {labelled.map((i) => (
              <text key={i} x={x(i)} y={baseY + 17} textAnchor="middle" fontSize={10.5} fill={muted(42)}>
                {formatDay(points[i]!.date)}
              </text>
            ))}
            {active !== null && (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={baseY} stroke={muted(20)} strokeWidth={1} />
            )}
            <polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={i === active ? 5.5 : 4}
                fill="var(--color-accent)"
                stroke="var(--color-bg)"
                strokeWidth={2}
              />
            ))}
            <text
              x={x(n - 1)}
              y={y(points[n - 1]!.value) - 12}
              textAnchor="end"
              fontSize={12}
              fill="var(--color-text)"
            >
              {fmtVal(points[n - 1]!.value)} {unit}
            </text>
          </svg>
        )}
        {a && active !== null && (
          <div
            className="chart-tip"
            style={{
              left: Math.max(80, Math.min(x(active), width - 80)),
              top: y(a.value) - 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {fmtVal(a.value)} {unit}
            </div>
            <div style={{ fontSize: 11.5, color: muted(60) }}>{a.detail}</div>
            <div style={{ fontSize: 11.5, color: muted(45) }}>{formatDay(a.date)}</div>
          </div>
        )}
      </div>
      <details style={{ marginTop: 6 }}>
        <summary className="text-muted" style={{ fontSize: 12, cursor: 'pointer' }}>
          Data table
        </summary>
        <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>{valueHeader}</th>
              <th>Session</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{formatDay(p.date)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtVal(p.value)}</td>
                <td>{p.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Decorative trend line for progression cards: the series in the de-emphasis
 * gray, the latest movement in the accent. The card's text carries the data. */
export function Sparkline({ values }: { values: number[] }) {
  const W = 132;
  const H = 36;
  const P = 4;
  const n = values.length;
  if (n < 2) return null;
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const x = (i: number) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
  const pts = (from: number, to: number) =>
    values
      .slice(from, to + 1)
      .map((v, i) => `${x(from + i)},${y(v)}`)
      .join(' ');
  return (
    <svg width={W} height={H} aria-hidden="true" style={{ display: 'block' }}>
      <polyline
        points={pts(0, n - 2)}
        fill="none"
        stroke="var(--color-neutral-600)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={pts(n - 2, n - 1)}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(n - 1)} cy={y(values[n - 1]!)} r={3} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={2} />
    </svg>
  );
}
