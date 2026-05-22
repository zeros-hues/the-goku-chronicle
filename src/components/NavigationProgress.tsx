"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

NProgress.configure({ showSpinner: false, trickleSpeed: 200, minimum: 0.08 });

export default function NavigationProgress() {
  const pathname = usePathname();
  const prev = useRef(pathname);

  // Start progress on any internal link click
  useEffect(() => {
    function onAnchorClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      const destPath = href.split("?")[0];
      if (destPath !== window.location.pathname) NProgress.start();
    }
    document.addEventListener("click", onAnchorClick);
    return () => document.removeEventListener("click", onAnchorClick);
  }, []);

  // Complete when pathname changes
  useEffect(() => {
    if (prev.current !== pathname) {
      NProgress.done();
      prev.current = pathname;
    }
  }, [pathname]);

  return null;
}
