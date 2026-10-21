import { useEffect } from 'react';

const BASE = 'City Guide: Paris';

// Sets the browser tab title: "Guides · City Guide: Paris", or just the site name.
export function useTitle(page) {
  useEffect(() => {
    document.title = page ? `${page} · ${BASE}` : BASE;
  }, [page]);
}
