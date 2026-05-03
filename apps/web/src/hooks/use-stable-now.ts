"use client";

import { useLayoutEffect, useState } from "react";

export function useStableNow() {
  const [now, setNow] = useState<number | null>(null);

  useLayoutEffect(() => {
    setNow(Date.now());
  }, []);

  // Return 0 on server (no hydration mismatch) and Date.now() on client after hydration
  return now ?? 0;
}