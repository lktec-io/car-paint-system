import { useEffect, useRef } from 'react';

/**
 * Fires callback immediately on mount, then every `interval` ms.
 * Cleans up on unmount or when `enabled` becomes false.
 *
 * @param {() => void} callback - Function to call on each tick
 * @param {number}     interval - Milliseconds between ticks (default 30 000)
 * @param {boolean}    enabled  - Set false to pause polling (e.g. when unauthenticated)
 */
export default function usePolling(callback, interval = 30_000, enabled = true) {
  // Keep a ref to the latest callback so the interval closure never stales
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    callbackRef.current(); // immediate first call

    const id = setInterval(() => callbackRef.current(), interval);
    return () => clearInterval(id);
  }, [interval, enabled]);
}
