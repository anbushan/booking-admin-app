// The same "empty fuel gauge" illustration as the mobile app's
// EmptyState/NoRidesFound (needle resting on E) — one consistent "no
// data" visual across both apps instead of admin's old plain circle
// glyph. SVG here (vs. the mobile app's rotated Views) since that's the
// natural way to draw an arc + rotated ticks on the web, no client JS
// needed either way.
const TICK_COUNT = 17;
const START_DEG = 174; // just short of full left (E)
const END_DEG = 6; // just short of full right (F)
const NEEDLE_DEG = 163; // resting near-empty, angled slightly above horizontal

export function EmptyGauge({ size = 110 }: { size?: number }) {
  const cx = size / 2;
  const cy = size * 0.6;
  const r = size * 0.42;
  const tickLen = size * 0.11;
  const tickThick = size * 0.05;
  const needleLen = r * 0.8;
  const height = cy + size * 0.16;

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const t = i / (TICK_COUNT - 1);
    const deg = START_DEG - t * (START_DEG - END_DEG);
    const rad = (deg * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy - r * Math.sin(rad);
    return { x, y, rotate: 90 - deg, isEmpty: i === 0 };
  });

  const needleRad = (NEEDLE_DEG * Math.PI) / 180;
  const needleX = cx + needleLen * Math.cos(needleRad);
  const needleY = cy - needleLen * Math.sin(needleRad);

  return (
    <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} fill="none">
      {ticks.map((tk, i) => (
        <rect
          key={i}
          x={tk.x - tickThick / 2}
          y={tk.y - tickLen / 2}
          width={tickThick}
          height={tickLen}
          rx={tickThick / 2}
          fill={tk.isEmpty ? "#A32D2D" : "#888780"}
          transform={`rotate(${tk.rotate} ${tk.x} ${tk.y})`}
        />
      ))}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#A32D2D" strokeWidth={size * 0.028} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={size * 0.05} fill="#1A1A18" />
      <text x={2} y={cy + size * 0.11} fontSize={size * 0.12} fontWeight={700} fill="#A32D2D">
        E
      </text>
      <text x={size - size * 0.13} y={cy + size * 0.11} fontSize={size * 0.12} fontWeight={700} fill="#888780">
        F
      </text>
    </svg>
  );
}
