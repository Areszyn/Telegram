export type AvatarDef = {
  id: number;
  bg: string;
  skin: string;
  eyes: "dots" | "round" | "closed" | "wink" | "lashes" | "sleepy" | "wide" | "angry" | "star";
  mouth: "smile" | "grin" | "neutral" | "open" | "smirk" | "tongue" | "oh" | "cat" | "teeth" | "sad";
  cheeks?: boolean;
  glasses?: "round" | "square" | "sun";
  hair?: "spiky" | "bangs" | "curly" | "pony" | "buzz" | "long" | "mohawk" | "bun" | "bob" | "afro";
  hat?: "cap" | "beanie" | "top";
  extras?: "freckles" | "blush" | "band" | "earring" | "mustache" | "beard";
  hairColor?: string;
  hatColor?: string;
};

const C = {
  pink: "#FFD6E0",
  peach: "#FFDEC2",
  yellow: "#FFF3BF",
  green: "#D3F9D8",
  mint: "#C3FAE8",
  blue: "#D0EBFF",
  purple: "#E5DBFF",
  lavender: "#EBD6FF",
  coral: "#FFD8CC",
  gray: "#E9ECEF",
};

const S = {
  light: "#FDDCB5",
  fair: "#F8D5B8",
  medium: "#E8B992",
  tan: "#D4A276",
  brown: "#B07D56",
  dark: "#8D5524",
};

export const AVATARS: AvatarDef[] = [
  { id: 1, bg: C.pink, skin: S.light, eyes: "dots", mouth: "smile" },
  { id: 2, bg: C.blue, skin: S.fair, eyes: "round", mouth: "grin", hair: "spiky", hairColor: "#5C4033" },
  { id: 3, bg: C.yellow, skin: S.medium, eyes: "closed", mouth: "smile", cheeks: true },
  { id: 4, bg: C.green, skin: S.tan, eyes: "dots", mouth: "neutral", glasses: "round" },
  { id: 5, bg: C.purple, skin: S.light, eyes: "lashes", mouth: "smirk", hair: "bangs", hairColor: "#2C1810" },
  { id: 6, bg: C.coral, skin: S.brown, eyes: "round", mouth: "open", hair: "curly", hairColor: "#1A1A1A" },
  { id: 7, bg: C.mint, skin: S.fair, eyes: "wink", mouth: "tongue" },
  { id: 8, bg: C.peach, skin: S.dark, eyes: "dots", mouth: "smile", hair: "buzz", hairColor: "#1A1A1A" },
  { id: 9, bg: C.lavender, skin: S.light, eyes: "round", mouth: "cat", hair: "pony", hairColor: "#B5651D" },
  { id: 10, bg: C.gray, skin: S.medium, eyes: "sleepy", mouth: "neutral" },

  { id: 11, bg: C.blue, skin: S.light, eyes: "dots", mouth: "grin", hat: "cap", hatColor: "#4A90D9" },
  { id: 12, bg: C.pink, skin: S.tan, eyes: "lashes", mouth: "smile", hair: "long", hairColor: "#2C1810", cheeks: true },
  { id: 13, bg: C.green, skin: S.fair, eyes: "wide", mouth: "oh" },
  { id: 14, bg: C.yellow, skin: S.brown, eyes: "round", mouth: "teeth", hair: "mohawk", hairColor: "#8B0000" },
  { id: 15, bg: C.purple, skin: S.medium, eyes: "dots", mouth: "smile", glasses: "square" },
  { id: 16, bg: C.coral, skin: S.light, eyes: "closed", mouth: "grin", hair: "bun", hairColor: "#D4A017" },
  { id: 17, bg: C.mint, skin: S.dark, eyes: "round", mouth: "neutral", hat: "beanie", hatColor: "#E74C3C" },
  { id: 18, bg: C.peach, skin: S.fair, eyes: "wink", mouth: "smirk", extras: "freckles" },
  { id: 19, bg: C.lavender, skin: S.medium, eyes: "lashes", mouth: "smile", hair: "bob", hairColor: "#FF6B6B" },
  { id: 20, bg: C.gray, skin: S.tan, eyes: "dots", mouth: "open", glasses: "sun" },

  { id: 21, bg: C.yellow, skin: S.light, eyes: "star", mouth: "grin" },
  { id: 22, bg: C.blue, skin: S.brown, eyes: "dots", mouth: "smile", hair: "afro", hairColor: "#1A1A1A" },
  { id: 23, bg: C.pink, skin: S.fair, eyes: "round", mouth: "tongue", hat: "top", hatColor: "#2C3E50" },
  { id: 24, bg: C.green, skin: S.medium, eyes: "closed", mouth: "cat", cheeks: true, hair: "bangs", hairColor: "#C0392B" },
  { id: 25, bg: C.purple, skin: S.dark, eyes: "dots", mouth: "neutral", extras: "mustache" },
  { id: 26, bg: C.coral, skin: S.light, eyes: "lashes", mouth: "grin", hair: "curly", hairColor: "#D4A017" },
  { id: 27, bg: C.mint, skin: S.fair, eyes: "angry", mouth: "neutral" },
  { id: 28, bg: C.peach, skin: S.tan, eyes: "round", mouth: "smile", hair: "spiky", hairColor: "#FF8C00", extras: "earring" },
  { id: 29, bg: C.lavender, skin: S.medium, eyes: "dots", mouth: "oh", glasses: "round", hair: "bob", hairColor: "#4A235A" },
  { id: 30, bg: C.gray, skin: S.light, eyes: "wink", mouth: "teeth" },

  { id: 31, bg: C.green, skin: S.dark, eyes: "round", mouth: "grin", hair: "buzz", hairColor: "#1A1A1A", extras: "beard" },
  { id: 32, bg: C.pink, skin: S.fair, eyes: "lashes", mouth: "smile", hair: "long", hairColor: "#FFD700" },
  { id: 33, bg: C.blue, skin: S.medium, eyes: "dots", mouth: "smirk", hat: "cap", hatColor: "#27AE60" },
  { id: 34, bg: C.yellow, skin: S.light, eyes: "closed", mouth: "smile", hair: "pony", hairColor: "#E67E22", cheeks: true },
  { id: 35, bg: C.purple, skin: S.tan, eyes: "sleepy", mouth: "neutral", extras: "band" },
  { id: 36, bg: C.coral, skin: S.brown, eyes: "round", mouth: "open", hair: "mohawk", hairColor: "#3498DB" },
  { id: 37, bg: C.mint, skin: S.fair, eyes: "wide", mouth: "grin", glasses: "square" },
  { id: 38, bg: C.peach, skin: S.dark, eyes: "dots", mouth: "cat", hair: "afro", hairColor: "#2C1810" },
  { id: 39, bg: C.lavender, skin: S.light, eyes: "round", mouth: "smile", hat: "beanie", hatColor: "#8E44AD" },
  { id: 40, bg: C.gray, skin: S.medium, eyes: "wink", mouth: "tongue", hair: "bangs", hairColor: "#1ABC9C" },

  { id: 41, bg: C.yellow, skin: S.tan, eyes: "lashes", mouth: "grin", hair: "bun", hairColor: "#2C1810" },
  { id: 42, bg: C.blue, skin: S.light, eyes: "dots", mouth: "sad" },
  { id: 43, bg: C.pink, skin: S.dark, eyes: "round", mouth: "smile", glasses: "sun", hair: "curly", hairColor: "#1A1A1A" },
  { id: 44, bg: C.green, skin: S.fair, eyes: "angry", mouth: "teeth", hair: "spiky", hairColor: "#C0392B" },
  { id: 45, bg: C.purple, skin: S.medium, eyes: "closed", mouth: "smile", extras: "blush" },
  { id: 46, bg: C.coral, skin: S.light, eyes: "star", mouth: "open", hair: "bob", hairColor: "#9B59B6" },
  { id: 47, bg: C.mint, skin: S.brown, eyes: "dots", mouth: "neutral", hat: "top", hatColor: "#1A1A1A", extras: "mustache" },
  { id: 48, bg: C.peach, skin: S.fair, eyes: "round", mouth: "grin", hair: "long", hairColor: "#E74C3C", extras: "earring" },
  { id: 49, bg: C.lavender, skin: S.tan, eyes: "sleepy", mouth: "smile", glasses: "round" },
  { id: 50, bg: C.gray, skin: S.dark, eyes: "wink", mouth: "smirk", hair: "afro", hairColor: "#1A1A1A" },
];

export function getAvatar(id: number | string | null | undefined): AvatarDef | null {
  if (!id) return null;
  const numId = typeof id === "string" ? parseInt(id, 10) : id;
  return AVATARS.find(a => a.id === numId) ?? null;
}
