import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

const FUNCTIONS_REGION = 'asia-southeast1';

type CheckDisplayNameAvailableInput = {
  displayName: string;
};

type CheckDisplayNameAvailableResult = {
  available: boolean;
};

export type NicknameAvailability = {
  available: boolean;
  checked: boolean;
};

const functions = getFunctions(app, FUNCTIONS_REGION);

const checkDisplayNameAvailableCallable = httpsCallable<
  CheckDisplayNameAvailableInput,
  CheckDisplayNameAvailableResult
>(functions, 'checkDisplayNameAvailable');

const MAX_SUGGESTED_NICKNAME_CHECKS = 3;

export async function checkNicknameAvailability(displayName: string): Promise<NicknameAvailability> {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return { available: false, checked: true };
  }

  try {
    const result = await checkDisplayNameAvailableCallable({ displayName: trimmed });
    return {
      available: result.data.available,
      checked: true,
    };
  } catch (error) {
    console.warn('Nickname availability check failed; allowing submit for server-side validation.', error);
    return {
      available: true,
      checked: false,
    };
  }
}

export async function isDisplayNameAvailable(displayName: string): Promise<boolean> {
  const result = await checkNicknameAvailability(displayName);
  return result.available;
}

export async function getSuggestedNicknames(baseName: string): Promise<string[]> {
  const cleanName = baseName.trim();
  if (!cleanName) return [];

  const candidates = [
    ...Array.from({ length: 5 }, (_, index) => `${cleanName}_${String(index + 1).padStart(3, '0')}`),
    `${cleanName}_${new Date().getFullYear()}`,
    `${cleanName}${Math.floor(Math.random() * 100)}`,
  ].slice(0, MAX_SUGGESTED_NICKNAME_CHECKS);

  const suggestions: string[] = [];
  for (const candidate of candidates) {
    if (suggestions.length >= MAX_SUGGESTED_NICKNAME_CHECKS) break;
    if (await isDisplayNameAvailable(candidate)) {
      suggestions.push(candidate);
    }
  }

  return suggestions;
}
