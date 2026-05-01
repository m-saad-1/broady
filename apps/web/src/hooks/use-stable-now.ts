"use client";

import { useEffect, useState } from "react";

export function useStableNow() {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  return now;
}