const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function getApiOrigin() {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return "http://localhost:4000";
  }
}

export function resolveMediaUrl(rawUrl?: string | null, fallback = "/window.svg") {
  const normalized = (rawUrl || "").trim().replace(/\\/g, "/");
  if (!normalized) {
    return fallback;
  }

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    return normalized;
  }

  const apiOrigin = getApiOrigin();

  if (normalized.startsWith("/uploads/") || normalized.startsWith("uploads/")) {
    const uploadPath = normalized.startsWith("/") ? normalized : `/${normalized}`;
    return `${apiOrigin}${uploadPath}`;
  }

  if (normalized.startsWith("/api/")) {
    return `${apiOrigin}${normalized}`;
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  return `${apiOrigin}/${normalized}`;
}
