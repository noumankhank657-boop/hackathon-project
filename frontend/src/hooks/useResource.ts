import { useCallback, useEffect, useRef, useState } from "react";

export function useResource<T>(load: () => Promise<T>, dependencies: unknown[] = []) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadRef.current()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [...dependencies, refreshIndex]);

  const refresh = useCallback(() => setRefreshIndex((index) => index + 1), []);

  return { data, setData, loading, error, refresh };
}

export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>, message?: string) => {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      if (message) setSuccess(message);
      return true;
    } catch (reason) {
      setError(reason);
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, error, success, run, setError, setSuccess };
}
