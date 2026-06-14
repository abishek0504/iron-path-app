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
