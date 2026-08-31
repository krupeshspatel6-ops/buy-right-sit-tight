import type { ChapterChart } from "@/lib/quotes";

// A server-rendered Japanese candlestick chart for a chapter — the stock's OHLC
// price action from the day it was bought, with a dashed line at the buy price
// (and a marker at the sell, if the chapter is closed). Pure SVG, no client JS,
// styled in the book's palette (green = up day, red = down day).
const GAIN = "#1a7f4e";
const LOSS = "#b3372f";
const INK_SOFT = "#6b675d";
const WALL_DARK = "#e7e0d1";
const TAPE = "#1e5fbf";

function fmtAxisDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    Number(m) - 1
  ];
  return `${mon} ${Number(d)} ’${y.slice(2)}`;
}

export default function CandleChart({ data, ticker }: { data: ChapterChart; ticker: string }) {
  const { candles, buyPrice, sell } = data;
  if (candles.length < 2) return null;

  const W = 720;
  const H = 260;
  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const prices = candles.flatMap((c) => [c.h, c.l]).concat([buyPrice], sell ? [sell.price] : []);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  const pad = (max - min) * 0.08 || max * 0.02 || 1;
  min -= pad;
  max += pad;
  const y = (p: number) => padT + plotH - ((p - min) / (max - min)) * plotH;

  const n = candles.length;
  const slot = plotW / n;
  const bodyW = Math.max(1.5, Math.min(slot * 0.62, 11));
  const cx = (i: number) => padL + slot * (i + 0.5);

  // 4 horizontal price gridlines
  const ticks = 4;
  const gridlines = Array.from({ length: ticks + 1 }, (_, i) => {
    const p = min + ((max - min) * i) / ticks;
    return { p, yy: y(p) };
  });

  const first = candles[0].t;
  const last = candles[candles.length - 1].t;
  const buyY = y(buyPrice);

  return (
    <figure className="my-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`${ticker} price since the buy, candlestick chart`}
        style={{ display: "block", background: "#fffdf8", borderRadius: 12, border: `1px solid ${WALL_DARK}` }}
      >
        {/* gridlines + price labels */}
        {gridlines.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={g.yy} y2={g.yy} stroke={WALL_DARK} strokeWidth={1} />
            <text x={padL - 6} y={g.yy + 3} textAnchor="end" fontSize={10} fill={INK_SOFT} fontFamily="Archivo, system-ui, sans-serif">
              ${g.p.toFixed(g.p < 10 ? 2 : 0)}
            </text>
          </g>
        ))}

        {/* the buy-price line */}
        <line x1={padL} x2={W - padR} y1={buyY} y2={buyY} stroke={TAPE} strokeWidth={1.4} strokeDasharray="5 4" />
        <text x={W - padR} y={buyY - 4} textAnchor="end" fontSize={10} fontWeight={700} fill={TAPE} fontFamily="Archivo, system-ui, sans-serif">
          bought ${buyPrice.toFixed(2)}
        </text>

        {/* candles */}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const color = up ? GAIN : LOSS;
          const x = cx(i);
          const yO = y(c.o);
          const yC = y(c.c);
          const top = Math.min(yO, yC);
          const h = Math.max(1, Math.abs(yC - yO));
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth={1} />
              <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} fill={color} />
            </g>
          );
        })}

        {/* sell marker (closed chapters) */}
        {sell && (
          <g>
            <line x1={cx(n - 1)} x2={cx(n - 1)} y1={padT} y2={padT + plotH} stroke={INK_SOFT} strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={cx(n - 1)} cy={y(sell.price)} r={3.2} fill="#fffdf8" stroke={INK_SOFT} strokeWidth={1.5} />
          </g>
        )}

        {/* date axis (first + last) */}
        <text x={padL} y={H - 8} textAnchor="start" fontSize={10} fill={INK_SOFT} fontFamily="Archivo, system-ui, sans-serif">
          {fmtAxisDate(first)}
        </text>
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize={10} fill={INK_SOFT} fontFamily="Archivo, system-ui, sans-serif">
          {fmtAxisDate(last)}
        </text>
      </svg>
      <figcaption className="font-grotesk mt-1 text-[11px] text-ink-soft">
        {ticker} since the buy · green up days, red down days ·{" "}
        <span style={{ color: TAPE }}>dashed line = what I paid</span>
        {sell ? " · circle = where I sold" : ""}
      </figcaption>
    </figure>
  );
}
