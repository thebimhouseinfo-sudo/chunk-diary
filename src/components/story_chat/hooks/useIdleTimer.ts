import { useEffect, useRef } from "react";

interface IdleTimerProps {
  on30sReminder: () => void;
  on60sReminder: () => void;
  onStop: () => void;
  isActive: boolean;
}

export function useIdleTimer({ on30sReminder, on60sReminder, onStop, isActive }: IdleTimerProps) {
  const timer30sRef = useRef<NodeJS.Timeout | null>(null);
  const timer60sRef = useRef<NodeJS.Timeout | null>(null);
  const timerStopRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimers = () => {
    clearTimers();

    if (!isActive) return;

    timer30sRef.current = setTimeout(() => {
      on30sReminder();
    }, 30000); // 30 seconds

    timer60sRef.current = setTimeout(() => {
      on60sReminder();
    }, 60000); // 60 seconds

    timerStopRef.current = setTimeout(() => {
      onStop();
    }, 90000); // Stop session or pause active monitoring after 90s total idle
  };

  const clearTimers = () => {
    if (timer30sRef.current) clearTimeout(timer30sRef.current);
    if (timer60sRef.current) clearTimeout(timer60sRef.current);
    if (timerStopRef.current) clearTimeout(timerStopRef.current);
  };

  useEffect(() => {
    resetTimers();
    return () => clearTimers();
  }, [isActive]);

  return { resetTimers, clearTimers };
}
