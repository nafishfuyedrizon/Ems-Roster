const explicitApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function stripApiSuffix(value: string) {
  return value.replace(/\/api$/, "");
}

const fallbackOrigin = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/ems-panel/, "");

export const API_ORIGIN = explicitApiBase
  ? stripApiSuffix(stripTrailingSlash(explicitApiBase))
  : fallbackOrigin;

export const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

export function withApiPath(path: string) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
