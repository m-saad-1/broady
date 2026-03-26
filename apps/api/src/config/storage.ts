export type StorageProvider = "cloudinary" | "s3";

export function getPublicAssetUrl(path: string, cdnBase?: string): string {
  if (!cdnBase) return path;
  return `${cdnBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
