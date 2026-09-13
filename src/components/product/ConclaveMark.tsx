import { useEffect, useRef } from "react";

export const ConclaveMark = ({ className = "" }: { className?: string }) => {
  const sprite = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const update = () => {
      if (sprite.current) sprite.current.dataset.paused = String(document.hidden);
    };

    update();
    document.addEventListener("visibilitychange", update);

    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return (
    <span className={`conclave-mark ${className}`} aria-hidden="true">
      <img ref={sprite} src="/conclave-sprite.svg" width="96" height="32" alt="" />
    </span>
  );
};
