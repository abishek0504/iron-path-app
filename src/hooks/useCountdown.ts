import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCountdownOptions {
  durationSec: number;
  autoStart?: boolean;
  onComplete?: () => void;
}

export function useCountdown({
  durationSec,
  autoStart = true,
  onComplete,
}: UseCountdownOptions) {
  const [secondsLeft, setSecondsLeft] = useState(durationSec);
  const [active, setActive] = useState(autoStart);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  onCompleteRef.current = onComplete;

  useEffect(() => {
    setSecondsLeft(durationSec);
    setActive(autoStart);
    completedRef.current = false;
  }, [durationSec, autoStart]);

  useEffect(() => {
    if (!active) return;

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(id);
          if (!completedRef.current) {
            completedRef.current = true;
            setActive(false);
            onCompleteRef.current?.();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [active]);

  const start = useCallback(() => {
    completedRef.current = false;
    setSecondsLeft(durationSec);
    setActive(true);
  }, [durationSec]);

  const progress = durationSec > 0 ? (durationSec - secondsLeft) / durationSec : 1;

  return {
    secondsLeft,
    isRunning: active,
    progress,
    start,
  };
}

export function formatCountdownTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface UseCountdownToEpochOptions {
  endsAtEpoch: number;
  startedAtEpoch?: number;
  onComplete?: () => void;
}

/** Wall-clock countdown to an absolute end time (stays in sync when extended). */
export function useCountdownToEpoch({
  endsAtEpoch,
  startedAtEpoch,
  onComplete,
}: UseCountdownToEpochOptions) {
  const computeSecondsLeft = useCallback(
    () => Math.max(0, Math.ceil(endsAtEpoch - Date.now() / 1000)),
    [endsAtEpoch],
  );

  const [secondsLeft, setSecondsLeft] = useState(computeSecondsLeft);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  onCompleteRef.current = onComplete;

  useEffect(() => {
    setSecondsLeft(computeSecondsLeft());
    completedRef.current = false;
  }, [endsAtEpoch, computeSecondsLeft]);

  useEffect(() => {
    const id = setInterval(() => {
      const next = computeSecondsLeft();
      setSecondsLeft(next);
      if (next <= 0 && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [computeSecondsLeft]);

  const totalSec =
    startedAtEpoch != null && endsAtEpoch > startedAtEpoch
      ? endsAtEpoch - startedAtEpoch
      : endsAtEpoch - (Date.now() / 1000 - secondsLeft);
  const elapsed = totalSec > 0 ? totalSec - secondsLeft : 0;
  const progress = totalSec > 0 ? Math.min(1, elapsed / totalSec) : 1;

  return { secondsLeft, progress };
}
