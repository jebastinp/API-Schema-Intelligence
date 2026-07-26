"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const timeoutRef = useRef<number | null>(null);
  const trickleRef = useRef<number | null>(null);
  const routeKeyRef = useRef("");
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    routeKeyRef.current = `${pathname}?${searchParams.toString()}`;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function startProgress(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const link = target.closest("a");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) {
        return;
      }
      const nextUrl = new URL(link.href, window.location.href);
      const nextRouteKey = `${nextUrl.pathname}${nextUrl.search}`;
      if (nextRouteKey === routeKeyRef.current) {
        return;
      }

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (trickleRef.current) {
        window.clearInterval(trickleRef.current);
        trickleRef.current = null;
      }

      setActive(true);
      startedAtRef.current = Date.now();
      setWidth(18);

      trickleRef.current = window.setInterval(() => {
        setWidth((current) => {
          if (current >= 92) {
            return current;
          }
          if (current >= 78) {
            return current + 1.5;
          }
          if (current >= 54) {
            return current + 4;
          }
          return current + 10;
        });
      }, 110);
    }

    document.addEventListener("click", startProgress, true);
    return () => {
      document.removeEventListener("click", startProgress, true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (trickleRef.current) {
        window.clearInterval(trickleRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!active) {
      routeKeyRef.current = `${pathname}?${searchParams.toString()}`;
      return;
    }

    const nextRouteKey = `${pathname}?${searchParams.toString()}`;
    if (nextRouteKey === routeKeyRef.current) {
      return;
    }

    routeKeyRef.current = nextRouteKey;
    if (trickleRef.current) {
      window.clearInterval(trickleRef.current);
      trickleRef.current = null;
    }

    setWidth(100);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    const elapsed = Date.now() - startedAtRef.current;
    const remainingVisibleTime = Math.max(0, 120 - elapsed);
    timeoutRef.current = window.setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, remainingVisibleTime + 90);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (trickleRef.current) {
        window.clearInterval(trickleRef.current);
        trickleRef.current = null;
      }
    };
  }, [active, pathname, searchParams]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-50 h-[6px] overflow-hidden bg-[#DBEAFE]/70">
      <div
        className="h-full bg-[#2563EB] shadow-[0_0_12px_rgba(37,99,235,0.7)] transition-[width,opacity] duration-150 ease-out"
        style={{
          width: `${width}%`,
          opacity: active || width > 0 ? 1 : 0,
        }}
      />
    </div>
  );
}
