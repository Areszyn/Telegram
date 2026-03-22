declare const __API_BASE__: string;

export const API_BASE: string =
  __API_BASE__ ||
  import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";
