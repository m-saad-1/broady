"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type PromoSlide = {
  message: string;
  imageUrl: string;
  alt: string;
};

type TopPromoBannerProps = {
  slides: PromoSlide[];
  intervalMs?: number;
};

export function TopPromoBanner({ slides, intervalMs = 3600 }: TopPromoBannerProps) {
  const list = useMemo(() => slides.filter((item) => item.message && item.imageUrl), [slides]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % list.length);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, list.length]);

  if (!list.length) return null;

  return (
    <section
      aria-live="polite"
      className="relative h-[22rem] overflow-hidden border border-zinc-300 md:h-[29rem]"
    >
      {list.map((slide, messageIndex) => (
        <div
          key={`${slide.message}-${messageIndex}`}
          className={`absolute inset-0 transition-all duration-500 ${
              messageIndex === index ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
        >
          <Image
            src={slide.imageUrl}
            alt={slide.alt}
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/45" />
          <p className="relative z-10 flex h-full items-center justify-center px-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white sm:text-[11px]">
            {slide.message}
          </p>
        </div>
      ))}
    </section>
  );
}
