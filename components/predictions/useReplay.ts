import * as React from "react";

const STEPS_PER_MODEL = 5;
const MODEL_COUNT = 3;
const TOTAL_STEPS = STEPS_PER_MODEL * MODEL_COUNT; // 15, round-robin across models
export const TOTAL_EVENTS = TOTAL_STEPS + MODEL_COUNT + 1; // + votes + consensus

export type ReplaySpeed = 1 | 5 | 10 | 30;

export function useReplay() {
  const [revealedCount, setRevealedCount] = React.useState(TOTAL_EVENTS);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState<ReplaySpeed>(1);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setRevealedCount((count) => {
        if (count >= TOTAL_EVENTS) {
          setPlaying(false);
          return count;
        }
        return count + 1;
      });
    }, 900 / speed);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speed]);

  const reset = React.useCallback(() => {
    setRevealedCount(0);
    setPlaying(true);
  }, []);

  const isStepRevealed = React.useCallback(
    (modelIndex: number, stepIndex: number) => revealedCount > stepIndex * MODEL_COUNT + modelIndex,
    [revealedCount],
  );

  const isVoteRevealed = React.useCallback(
    (modelIndex: number) => revealedCount > TOTAL_STEPS + modelIndex,
    [revealedCount],
  );

  const isConsensusRevealed = revealedCount >= TOTAL_EVENTS;
  const revealedVoteCount = Math.max(0, Math.min(MODEL_COUNT, revealedCount - TOTAL_STEPS));

  return {
    revealedCount,
    setRevealedCount,
    playing,
    setPlaying,
    speed,
    setSpeed,
    reset,
    isStepRevealed,
    isVoteRevealed,
    isConsensusRevealed,
    revealedVoteCount,
    totalEvents: TOTAL_EVENTS,
  };
}
