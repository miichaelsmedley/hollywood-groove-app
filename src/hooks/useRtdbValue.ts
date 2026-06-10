import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";

export interface RtdbValueState<T> {
  value: T | null;
  loading: boolean;
  error: Error | null;
}

export function useRtdbValue<T>(path: string | null): RtdbValueState<T> {
  const [state, setState] = useState<RtdbValueState<T>>({
    value: null,
    loading: Boolean(path),
    error: null,
  });

  useEffect(() => {
    if (!path) {
      setState({ value: null, loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    const unsubscribe = onValue(
      ref(db, path),
      (snapshot) => {
        setState({
          value: snapshot.exists() ? (snapshot.val() as T) : null,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState({ value: null, loading: false, error: err });
      },
    );

    return () => unsubscribe();
  }, [path]);

  return state;
}
