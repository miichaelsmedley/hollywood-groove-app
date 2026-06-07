// Reactive Firebase auth user. Re-renders consumers when the user signs in or
// out — including anonymous → real-account transitions — so a view can switch
// between a sign-in prompt and authenticated content without a manual refresh.

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../../lib/firebase";

export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}
