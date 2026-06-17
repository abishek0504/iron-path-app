let pendingAppTour = false;

export function setPendingAppTour(value = true): void {
  pendingAppTour = value;
}

export function takePendingAppTour(): boolean {
  const value = pendingAppTour;
  pendingAppTour = false;
  return value;
}

export function hasPendingAppTour(): boolean {
  return pendingAppTour;
}
