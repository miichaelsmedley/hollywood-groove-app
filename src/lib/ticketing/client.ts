import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import app from "../firebase";

export const TICKETING_DATABASE_ID = "ticketing";
export const FUNCTIONS_REGION = "asia-southeast1";

export const firestoreTicketing = getFirestore(app, TICKETING_DATABASE_ID);
export const functions = getFunctions(app, FUNCTIONS_REGION);
