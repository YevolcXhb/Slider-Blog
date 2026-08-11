"use client";

import { useEffect } from "react";
import { incrementViewCount } from "@/server/actions/post";

export function ViewTracker({ postId }: { postId: number }) {
  useEffect(() => {
    // Guard against double-counting:
    // - React StrictMode double-invokes effects in development.
    // - A user refreshing the page within the same session should not inflate
    //   the view count repeatedly.
    // sessionStorage is tab-scoped and cleared when the tab closes, which is
    // the desired granularity for "unique view per visit".
    const storageKey = `viewed:${postId}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // sessionStorage may be unavailable (e.g. private mode) — proceed to
      // count the view rather than silently dropping it.
    }
    incrementViewCount(postId);
  }, [postId]);
  return null;
}
