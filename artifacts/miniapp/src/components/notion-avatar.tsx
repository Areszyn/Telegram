import { getAvatar, type AvatarDef } from "@/lib/avatars";

type Props = {
  avatarId: number | string | null | undefined;
  size?: number;
  className?: string;
  fallback?: string;
};

export function NotionAvatar({ avatarId, size = 40, className = "", fallback }: Props) {
  const av = getAvatar(avatarId);
  if (!av) {
    const letter = (fallback || "U")[0].toUpperCase();
    return (
      <div
        className={`rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {letter}
      </div>
    );
  }

  const r = size / 2;
  const cx = r;
  const cy = r;
  const faceR = r * 0.62;
  const faceY = cy + r * 0.08;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${className}`}
      style={{ borderRadius: "50%" }}
    >
      <circle cx={cx} cy={cy} r={r} fill={av.bg} />
      {renderHairBack(av, cx, cy, r)}
      {av.hat && renderHat(av, cx, cy, r)}
      <circle cx={cx} cy={faceY} r={faceR} fill={av.skin} />
      {av.cheeks && renderCheeks(cx, faceY, faceR)}
      {av.extras === "freckles" && renderFreckles(cx, faceY, faceR)}
      {av.extras === "blush" && renderCheeks(cx, faceY, faceR)}
      {renderEyes(av, cx, faceY, faceR)}
      {renderMouth(av, cx, faceY, faceR)}
      {av.glasses && renderGlasses(av, cx, faceY, faceR)}
      {av.extras === "mustache" && renderMustache(cx, faceY, faceR)}
      {av.extras === "beard" && renderBeard(av, cx, faceY, faceR)}
      {av.extras === "band" && renderBand(cx, faceY, faceR)}
      {av.extras === "earring" && renderEarring(cx, faceY, faceR)}
      {renderHairFront(av, cx, cy, r, faceR)}
      {av.hat && renderHatFront(av, cx, cy, r)}
    </svg>
  );
}

function renderEyes(av: AvatarDef, cx: number, fy: number, fr: number) {
  const ey = fy - fr * 0.12;
  const ex = fr * 0.3;
  const s = fr * 0.08;
  switch (av.eyes) {
    case "dots":
      return (
        <>
          <circle cx={cx - ex} cy={ey} r={s} fill="#2D2D2D" />
          <circle cx={cx + ex} cy={ey} r={s} fill="#2D2D2D" />
        </>
      );
    case "round":
      return (
        <>
          <circle cx={cx - ex} cy={ey} r={s * 1.4} fill="white" />
          <circle cx={cx - ex} cy={ey} r={s * 0.7} fill="#2D2D2D" />
          <circle cx={cx + ex} cy={ey} r={s * 1.4} fill="white" />
          <circle cx={cx + ex} cy={ey} r={s * 0.7} fill="#2D2D2D" />
        </>
      );
    case "closed":
      return (
        <>
          <path d={`M${cx - ex - s * 1.2},${ey} Q${cx - ex},${ey + s * 1.2} ${cx - ex + s * 1.2},${ey}`} fill="none" stroke="#2D2D2D" strokeWidth={s * 0.6} strokeLinecap="round" />
          <path d={`M${cx + ex - s * 1.2},${ey} Q${cx + ex},${ey + s * 1.2} ${cx + ex + s * 1.2},${ey}`} fill="none" stroke="#2D2D2D" strokeWidth={s * 0.6} strokeLinecap="round" />
        </>
      );
    case "wink":
      return (
        <>
          <circle cx={cx - ex} cy={ey} r={s} fill="#2D2D2D" />
          <path d={`M${cx + ex - s * 1.2},${ey} Q${cx + ex},${ey + s * 1.2} ${cx + ex + s * 1.2},${ey}`} fill="none" stroke="#2D2D2D" strokeWidth={s * 0.6} strokeLinecap="round" />
        </>
      );
    case "lashes":
      return (
        <>
          <circle cx={cx - ex} cy={ey} r={s} fill="#2D2D2D" />
          <line x1={cx - ex} y1={ey - s * 1.5} x2={cx - ex - s * 0.8} y2={ey - s * 2.3} stroke="#2D2D2D" strokeWidth={s * 0.4} strokeLinecap="round" />
          <line x1={cx - ex} y1={ey - s * 1.5} x2={cx - ex + s * 0.8} y2={ey - s * 2.3} stroke="#2D2D2D" strokeWidth={s * 0.4} strokeLinecap="round" />
          <circle cx={cx + ex} cy={ey} r={s} fill="#2D2D2D" />
          <line x1={cx + ex} y1={ey - s * 1.5} x2={cx + ex - s * 0.8} y2={ey - s * 2.3} stroke="#2D2D2D" strokeWidth={s * 0.4} strokeLinecap="round" />
          <line x1={cx + ex} y1={ey - s * 1.5} x2={cx + ex + s * 0.8} y2={ey - s * 2.3} stroke="#2D2D2D" strokeWidth={s * 0.4} strokeLinecap="round" />
        </>
      );
    case "sleepy":
      return (
        <>
          <path d={`M${cx - ex - s * 1.2},${ey - s * 0.3} L${cx - ex + s * 1.2},${ey - s * 0.3}`} stroke="#2D2D2D" strokeWidth={s * 0.6} strokeLinecap="round" />
          <path d={`M${cx + ex - s * 1.2},${ey - s * 0.3} L${cx + ex + s * 1.2},${ey - s * 0.3}`} stroke="#2D2D2D" strokeWidth={s * 0.6} strokeLinecap="round" />
        </>
      );
    case "wide":
      return (
        <>
          <circle cx={cx - ex} cy={ey} r={s * 1.6} fill="white" />
          <circle cx={cx - ex} cy={ey + s * 0.3} r={s * 0.9} fill="#2D2D2D" />
          <circle cx={cx + ex} cy={ey} r={s * 1.6} fill="white" />
          <circle cx={cx + ex} cy={ey + s * 0.3} r={s * 0.9} fill="#2D2D2D" />
        </>
      );
    case "angry":
      return (
        <>
          <line x1={cx - ex - s * 1.3} y1={ey - s * 1.5} x2={cx - ex + s * 1.3} y2={ey - s * 0.6} stroke="#2D2D2D" strokeWidth={s * 0.5} strokeLinecap="round" />
          <circle cx={cx - ex} cy={ey} r={s} fill="#2D2D2D" />
          <line x1={cx + ex + s * 1.3} y1={ey - s * 1.5} x2={cx + ex - s * 1.3} y2={ey - s * 0.6} stroke="#2D2D2D" strokeWidth={s * 0.5} strokeLinecap="round" />
          <circle cx={cx + ex} cy={ey} r={s} fill="#2D2D2D" />
        </>
      );
    case "star":
      return (
        <>
          <text x={cx - ex} y={ey + s * 0.6} textAnchor="middle" fontSize={s * 3.5} fill="#FFD700">★</text>
          <text x={cx + ex} y={ey + s * 0.6} textAnchor="middle" fontSize={s * 3.5} fill="#FFD700">★</text>
        </>
      );
    default:
      return null;
  }
}

function renderMouth(av: AvatarDef, cx: number, fy: number, fr: number) {
  const my = fy + fr * 0.3;
  const s = fr * 0.08;
  const mw = fr * 0.25;
  switch (av.mouth) {
    case "smile":
      return <path d={`M${cx - mw},${my} Q${cx},${my + mw * 0.8} ${cx + mw},${my}`} fill="none" stroke="#2D2D2D" strokeWidth={s * 0.6} strokeLinecap="round" />;
    case "grin":
      return <path d={`M${cx - mw},${my} Q${cx},${my + mw * 1.1} ${cx + mw},${my}`} fill="white" stroke="#2D2D2D" strokeWidth={s * 0.5} />;
    case "neutral":
      return <line x1={cx - mw * 0.7} y1={my} x2={cx + mw * 0.7} y2={my} stroke="#2D2D2D" strokeWidth={s * 0.6} strokeLinecap="round" />;
    case "open":
      return <ellipse cx={cx} cy={my + s} rx={mw * 0.6} ry={mw * 0.5} fill="#2D2D2D" />;
    case "smirk":
      return <path d={`M${cx - mw * 0.3},${my} Q${cx + mw * 0.3},${my + mw * 0.7} ${cx + mw},${my - s * 0.5}`} fill="none" stroke="#2D2D2D" strokeWidth={s * 0.6} strokeLinecap="round" />;
    case "tongue":
      return (
        <>
          <path d={`M${cx - mw},${my} Q${cx},${my + mw * 0.8} ${cx + mw},${my}`} fill="none" stroke="#2D2D2D" strokeWidth={s * 0.5} strokeLinecap="round" />
          <ellipse cx={cx} cy={my + mw * 0.5} rx={mw * 0.3} ry={mw * 0.25} fill="#FF6B6B" />
        </>
      );
    case "oh":
      return <circle cx={cx} cy={my + s} r={mw * 0.35} fill="#2D2D2D" />;
    case "cat":
      return (
        <>
          <path d={`M${cx},${my} Q${cx - mw * 0.8},${my + mw * 0.6} ${cx - mw},${my - s}`} fill="none" stroke="#2D2D2D" strokeWidth={s * 0.5} strokeLinecap="round" />
          <path d={`M${cx},${my} Q${cx + mw * 0.8},${my + mw * 0.6} ${cx + mw},${my - s}`} fill="none" stroke="#2D2D2D" strokeWidth={s * 0.5} strokeLinecap="round" />
        </>
      );
    case "teeth":
      return (
        <>
          <path d={`M${cx - mw},${my} Q${cx},${my + mw} ${cx + mw},${my}`} fill="white" stroke="#2D2D2D" strokeWidth={s * 0.5} />
          <line x1={cx} y1={my} x2={cx} y2={my + mw * 0.5} stroke="#2D2D2D" strokeWidth={s * 0.3} />
        </>
      );
    case "sad":
      return <path d={`M${cx - mw},${my + mw * 0.4} Q${cx},${my - mw * 0.3} ${cx + mw},${my + mw * 0.4}`} fill="none" stroke="#2D2D2D" strokeWidth={s * 0.6} strokeLinecap="round" />;
    default:
      return null;
  }
}

function renderCheeks(cx: number, fy: number, fr: number) {
  const cy = fy + fr * 0.15;
  const ex = fr * 0.5;
  return (
    <>
      <circle cx={cx - ex} cy={cy} r={fr * 0.12} fill="#FFB3B3" opacity={0.5} />
      <circle cx={cx + ex} cy={cy} r={fr * 0.12} fill="#FFB3B3" opacity={0.5} />
    </>
  );
}

function renderFreckles(cx: number, fy: number, fr: number) {
  const cy = fy + fr * 0.08;
  const s = fr * 0.03;
  return (
    <>
      <circle cx={cx - fr * 0.35} cy={cy} r={s} fill="#C4956A" opacity={0.6} />
      <circle cx={cx - fr * 0.25} cy={cy - fr * 0.06} r={s} fill="#C4956A" opacity={0.6} />
      <circle cx={cx - fr * 0.3} cy={cy + fr * 0.06} r={s} fill="#C4956A" opacity={0.6} />
      <circle cx={cx + fr * 0.35} cy={cy} r={s} fill="#C4956A" opacity={0.6} />
      <circle cx={cx + fr * 0.25} cy={cy - fr * 0.06} r={s} fill="#C4956A" opacity={0.6} />
      <circle cx={cx + fr * 0.3} cy={cy + fr * 0.06} r={s} fill="#C4956A" opacity={0.6} />
    </>
  );
}

function renderGlasses(av: AvatarDef, cx: number, fy: number, fr: number) {
  const ey = fy - fr * 0.12;
  const ex = fr * 0.3;
  const gr = fr * 0.17;
  const sw = fr * 0.04;
  const isSun = av.glasses === "sun";
  const fill = isSun ? "rgba(0,0,0,0.35)" : "none";
  if (av.glasses === "square") {
    const hs = gr * 0.85;
    return (
      <>
        <rect x={cx - ex - hs} y={ey - hs} width={hs * 2} height={hs * 2} rx={sw} fill={fill} stroke="#2D2D2D" strokeWidth={sw} />
        <rect x={cx + ex - hs} y={ey - hs} width={hs * 2} height={hs * 2} rx={sw} fill={fill} stroke="#2D2D2D" strokeWidth={sw} />
        <line x1={cx - ex + hs} y1={ey} x2={cx + ex - hs} y2={ey} stroke="#2D2D2D" strokeWidth={sw * 0.7} />
      </>
    );
  }
  return (
    <>
      <circle cx={cx - ex} cy={ey} r={gr} fill={fill} stroke="#2D2D2D" strokeWidth={sw} />
      <circle cx={cx + ex} cy={ey} r={gr} fill={fill} stroke="#2D2D2D" strokeWidth={sw} />
      <line x1={cx - ex + gr} y1={ey} x2={cx + ex - gr} y2={ey} stroke="#2D2D2D" strokeWidth={sw * 0.7} />
    </>
  );
}

function renderHairBack(av: AvatarDef, cx: number, cy: number, r: number) {
  if (!av.hair) return null;
  const c = av.hairColor || "#5C4033";
  const faceY = cy + r * 0.08;
  const fr = r * 0.62;
  switch (av.hair) {
    case "long":
      return <ellipse cx={cx} cy={faceY - fr * 0.1} rx={fr * 1.15} ry={fr * 1.6} fill={c} />;
    case "afro":
      return <circle cx={cx} cy={faceY - fr * 0.15} r={fr * 1.35} fill={c} />;
    case "curly":
      return <ellipse cx={cx} cy={faceY - fr * 0.2} rx={fr * 1.1} ry={fr * 1.2} fill={c} />;
    default:
      return null;
  }
}

function renderHairFront(av: AvatarDef, cx: number, _cy: number, r: number, fr: number) {
  if (!av.hair) return null;
  const c = av.hairColor || "#5C4033";
  const faceY = _cy + r * 0.08;
  const top = faceY - fr;
  switch (av.hair) {
    case "spiky":
      return (
        <g>
          <path d={`M${cx - fr * 0.6},${top + fr * 0.2} L${cx - fr * 0.3},${top - fr * 0.4} L${cx},${top + fr * 0.1} L${cx + fr * 0.3},${top - fr * 0.35} L${cx + fr * 0.6},${top + fr * 0.2}`} fill={c} />
          <path d={`M${cx - fr * 0.7},${top + fr * 0.3} Q${cx},${top - fr * 0.1} ${cx + fr * 0.7},${top + fr * 0.3}`} fill={c} />
        </g>
      );
    case "bangs":
      return <path d={`M${cx - fr * 0.75},${top + fr * 0.35} Q${cx - fr * 0.3},${top - fr * 0.05} ${cx + fr * 0.2},${top + fr * 0.15} Q${cx + fr * 0.5},${top + fr * 0.05} ${cx + fr * 0.75},${top + fr * 0.35}`} fill={c} />;
    case "pony":
      return (
        <g>
          <path d={`M${cx - fr * 0.7},${top + fr * 0.3} Q${cx},${top - fr * 0.15} ${cx + fr * 0.7},${top + fr * 0.3}`} fill={c} />
          <ellipse cx={cx + fr * 0.65} cy={top - fr * 0.1} rx={fr * 0.15} ry={fr * 0.25} fill={c} />
        </g>
      );
    case "buzz":
      return <path d={`M${cx - fr * 0.7},${top + fr * 0.4} Q${cx},${top - fr * 0.05} ${cx + fr * 0.7},${top + fr * 0.4}`} fill={c} />;
    case "mohawk":
      return (
        <g>
          <path d={`M${cx - fr * 0.15},${top + fr * 0.2} L${cx - fr * 0.1},${top - fr * 0.6} Q${cx},${top - fr * 0.7} ${cx + fr * 0.1},${top - fr * 0.6} L${cx + fr * 0.15},${top + fr * 0.2}`} fill={c} />
          <path d={`M${cx - fr * 0.6},${top + fr * 0.4} Q${cx},${top + fr * 0.1} ${cx + fr * 0.6},${top + fr * 0.4}`} fill={c} />
        </g>
      );
    case "bun":
      return (
        <g>
          <path d={`M${cx - fr * 0.7},${top + fr * 0.3} Q${cx},${top - fr * 0.1} ${cx + fr * 0.7},${top + fr * 0.3}`} fill={c} />
          <circle cx={cx} cy={top - fr * 0.3} r={fr * 0.25} fill={c} />
        </g>
      );
    case "bob":
      return (
        <g>
          <path d={`M${cx - fr * 0.75},${top + fr * 0.3} Q${cx},${top - fr * 0.1} ${cx + fr * 0.75},${top + fr * 0.3}`} fill={c} />
          <rect x={cx - fr * 0.78} y={top + fr * 0.2} width={fr * 0.25} height={fr * 0.8} rx={fr * 0.1} fill={c} />
          <rect x={cx + fr * 0.53} y={top + fr * 0.2} width={fr * 0.25} height={fr * 0.8} rx={fr * 0.1} fill={c} />
        </g>
      );
    case "long":
      return <path d={`M${cx - fr * 0.75},${top + fr * 0.3} Q${cx},${top - fr * 0.15} ${cx + fr * 0.75},${top + fr * 0.3}`} fill={c} />;
    case "curly":
      return <path d={`M${cx - fr * 0.8},${top + fr * 0.35} Q${cx - fr * 0.4},${top - fr * 0.2} ${cx},${top + fr * 0.05} Q${cx + fr * 0.4},${top - fr * 0.2} ${cx + fr * 0.8},${top + fr * 0.35}`} fill={c} />;
    case "afro":
      return null;
    default:
      return null;
  }
}

function renderHat(av: AvatarDef, cx: number, cy: number, r: number) {
  const faceY = cy + r * 0.08;
  const fr = r * 0.62;
  const top = faceY - fr;
  const c = av.hatColor || "#2C3E50";
  switch (av.hat) {
    case "beanie":
      return (
        <g>
          <ellipse cx={cx} cy={top + fr * 0.15} rx={fr * 0.8} ry={fr * 0.45} fill={c} />
          <circle cx={cx} cy={top - fr * 0.2} r={fr * 0.1} fill={c} />
        </g>
      );
    default:
      return null;
  }
}

function renderHatFront(av: AvatarDef, cx: number, cy: number, r: number) {
  const faceY = cy + r * 0.08;
  const fr = r * 0.62;
  const top = faceY - fr;
  const c = av.hatColor || "#2C3E50";
  switch (av.hat) {
    case "cap":
      return (
        <g>
          <ellipse cx={cx} cy={top + fr * 0.25} rx={fr * 0.85} ry={fr * 0.35} fill={c} />
          <ellipse cx={cx + fr * 0.5} cy={top + fr * 0.3} rx={fr * 0.55} ry={fr * 0.12} fill={c} opacity={0.8} />
        </g>
      );
    case "top":
      return (
        <g>
          <rect x={cx - fr * 0.4} y={top - fr * 0.7} width={fr * 0.8} height={fr * 0.8} rx={fr * 0.05} fill={c} />
          <ellipse cx={cx} cy={top + fr * 0.15} rx={fr * 0.65} ry={fr * 0.12} fill={c} />
        </g>
      );
    default:
      return null;
  }
}

function renderMustache(cx: number, fy: number, fr: number) {
  const my = fy + fr * 0.18;
  return (
    <path
      d={`M${cx - fr * 0.25},${my} Q${cx - fr * 0.15},${my - fr * 0.1} ${cx},${my} Q${cx + fr * 0.15},${my - fr * 0.1} ${cx + fr * 0.25},${my}`}
      fill="#3E2723" stroke="#3E2723" strokeWidth={fr * 0.03}
    />
  );
}

function renderBeard(av: AvatarDef, cx: number, fy: number, fr: number) {
  const c = av.hairColor || "#3E2723";
  return (
    <path
      d={`M${cx - fr * 0.4},${fy + fr * 0.2} Q${cx - fr * 0.45},${fy + fr * 0.7} ${cx},${fy + fr * 0.8} Q${cx + fr * 0.45},${fy + fr * 0.7} ${cx + fr * 0.4},${fy + fr * 0.2}`}
      fill={c} opacity={0.7}
    />
  );
}

function renderBand(cx: number, fy: number, fr: number) {
  return <rect x={cx - fr * 0.7} y={fy - fr * 0.35} width={fr * 1.4} height={fr * 0.12} rx={fr * 0.03} fill="#E74C3C" opacity={0.8} />;
}

function renderEarring(cx: number, fy: number, fr: number) {
  return <circle cx={cx - fr * 0.65} cy={fy + fr * 0.1} r={fr * 0.06} fill="#FFD700" />;
}
