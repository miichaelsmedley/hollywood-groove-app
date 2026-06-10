import { onSnapshot, type DocumentReference, type Query } from "firebase/firestore";
import { useEffect, useState } from "react";

export interface FirestoreCollectionState<T> {
  items: Array<T & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export interface FirestoreDocState<T> {
  item: (T & { id: string }) | null;
  loading: boolean;
  error: Error | null;
}

export function useFirestoreCollection<T>(
  firestoreQuery: Query | null | undefined,
): FirestoreCollectionState<T> {
  const [state, setState] = useState<FirestoreCollectionState<T>>({
    items: [],
    loading: Boolean(firestoreQuery),
    error: null,
  });

  useEffect(() => {
    if (!firestoreQuery) {
      setState({ items: [], loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    const unsub = onSnapshot(
      firestoreQuery,
      (snap) => {
        setState({
          items: snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as T),
          })),
          loading: false,
          error: null,
        });
      },
      (err) => setState({ items: [], loading: false, error: err }),
    );
    return () => unsub();
  }, [firestoreQuery]);

  return state;
}

export function useFirestoreDoc<T>(
  firestoreDoc: DocumentReference | null | undefined,
): FirestoreDocState<T> {
  const [state, setState] = useState<FirestoreDocState<T>>({
    item: null,
    loading: Boolean(firestoreDoc),
    error: null,
  });

  useEffect(() => {
    if (!firestoreDoc) {
      setState({ item: null, loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    const unsub = onSnapshot(
      firestoreDoc,
      (snap) => {
        if (!snap.exists()) {
          setState({ item: null, loading: false, error: null });
          return;
        }
        setState({
          item: { id: snap.id, ...(snap.data() as T) },
          loading: false,
          error: null,
        });
      },
      (err) => setState({ item: null, loading: false, error: err }),
    );
    return () => unsub();
  }, [firestoreDoc]);

  return state;
}
