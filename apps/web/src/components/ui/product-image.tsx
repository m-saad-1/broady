import Image from "next/image";
import { resolveMediaUrl } from "@/lib/media-url";

type ProductImageProps = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
};

function isExternalHttpUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("http://") || normalized.startsWith("https://");
}

export function ProductImage({
  src,
  alt,
  className,
  fill,
  sizes,
  priority,
  width,
  height,
}: ProductImageProps) {
  const resolvedSrc = resolveMediaUrl(src);

  if (isExternalHttpUrl(resolvedSrc)) {
    if (fill) {
      return (
        <img
          src={resolvedSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full ${className || ""}`}
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <img
        src={resolvedSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        className={className}
        width={width}
        height={height}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      width={width}
      height={height}
      className={className}
    />
  );
}
