import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';

export function useRealtimeConnection(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = onValue(
      ref(db, '.info/connected'),
      (snapshot) => {
        setIsConnected(snapshot.val() === true);
      },
      () => {
        setIsConnected(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return isConnected;
}
