import { useCallback, useEffect, useState } from "react";

export function useResource<T>(load: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await load());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load data");
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, setData, loading, error, refresh };
}

export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError(reason instanceof Error ? reason.message : "Unable to complete this action");
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, error, success, run, setError, setSuccess };
}
