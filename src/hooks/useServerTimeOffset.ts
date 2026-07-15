import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';

export function useServerTimeOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, '.info/serverTimeOffset'), (snapshot) => {
      const value = snapshot.val();
      setOffset(typeof value === 'number' ? value : 0);
    });

    return () => unsubscribe();
  }, []);

  return offset;
}
