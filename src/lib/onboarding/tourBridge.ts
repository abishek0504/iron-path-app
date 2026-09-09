import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = 'ironpath.tour.pending.v1';
const STEP_KEY = 'ironpath.tour.stepIndex.v1';

let pendingAppTour = false;

export function setPendingAppTour(value = true): void {
  pendingAppTour = value;
  void AsyncStorage.setItem(PENDING_KEY, value ? '1' : '0');
  if (value) {
    void AsyncStorage.setItem(STEP_KEY, '0');
  }
}

export function takePendingAppTour(): boolean {
  const value = pendingAppTour;
  pendingAppTour = false;
  return value;
}

export function hasPendingAppTour(): boolean {
  return pendingAppTour;
}

export async function loadTourResumeState(): Promise<{ pending: boolean; stepIndex: number }> {
  const [storedPending, storedStep] = await Promise.all([
    AsyncStorage.getItem(PENDING_KEY),
    AsyncStorage.getItem(STEP_KEY),
  ]);
  const inMemory = pendingAppTour;
  pendingAppTour = false;
  const parsedStep = Number(storedStep);
  return {
    pending: inMemory || storedPending === '1',
    stepIndex: Number.isFinite(parsedStep) && parsedStep >= 0 ? parsedStep : 0,
  };
}

export async function persistTourStepIndex(index: number): Promise<void> {
  await AsyncStorage.setItem(STEP_KEY, String(index));
}

export async function clearTourPersistence(): Promise<void> {
  pendingAppTour = false;
  await AsyncStorage.multiRemove([PENDING_KEY, STEP_KEY]);
}
