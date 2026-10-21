const TRANSITION_STAGE_MINIMUM_PX = 320;
const TRANSITION_STAGE_VIEWPORT_OFFSET_PX = 32;

type TransitionStageHeightInput = {
  isTransitionActive: boolean;
  snapshotHeight?: number | null;
  viewportHeight?: number | null;
};

function normalizeDimension(value?: number | null) {
  return Number.isFinite(value) && value && value > 0 ? value : 0;
}

export function resolveTransitionStageMinHeight({
  isTransitionActive,
  snapshotHeight,
  viewportHeight,
}: TransitionStageHeightInput) {
  if (!isTransitionActive) {
    return null;
  }

  const normalizedSnapshotHeight = normalizeDimension(snapshotHeight);
  const normalizedViewportHeight = normalizeDimension(viewportHeight);
  const viewportSafeMinimum = Math.max(
    normalizedViewportHeight - TRANSITION_STAGE_VIEWPORT_OFFSET_PX,
    TRANSITION_STAGE_MINIMUM_PX,
  );

  return Math.max(normalizedSnapshotHeight, viewportSafeMinimum);
}

type WaitingContentMotionInput = {
  isWaitingForTarget: boolean;
};

export function resolveWaitingContentMotion({ isWaitingForTarget }: WaitingContentMotionInput) {
  if (!isWaitingForTarget) {
    return {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
    };
  }

  return {
    opacity: 0.14,
    x: 0,
    scale: 0.985,
    filter: "blur(4px)",
  };
}
