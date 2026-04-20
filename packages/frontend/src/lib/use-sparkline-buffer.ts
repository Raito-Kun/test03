import { useEffect, useRef, useState } from "react";

// Buffer the last N values observed from a reactive source (usually a React
// Query result or a websocket metric). Returns the current buffer plus a push
// helper for manual writes. Chosen over localStorage persistence per phase-01
// decision (KISS; 7 refetches ≈ last 3.5 minutes of dashboard activity).
export function useSparklineBuffer(value: number | undefined, size = 7) {
  const [buffer, setBuffer] = useState<number[]>(() =>
    typeof value === "number" ? [value] : [],
  );
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    if (typeof value !== "number" || Number.isNaN(value)) return;
    setBuffer((prev) => {
      const next = [...prev, value];
      if (next.length > sizeRef.current) next.splice(0, next.length - sizeRef.current);
      return next;
    });
  }, [value]);

  return buffer;
}
