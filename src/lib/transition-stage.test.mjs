import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { resolveTransitionStageMinHeight, resolveWaitingContentMotion } from "./transition-stage.ts";

test("resolveTransitionStageMinHeight returns null when no transition is active", () => {
  assert.equal(
    resolveTransitionStageMinHeight({
      isTransitionActive: false,
      snapshotHeight: 1600,
      viewportHeight: 900,
    }),
    null,
  );
});

test("resolveTransitionStageMinHeight keeps the captured stage height when it is taller than the viewport floor", () => {
  assert.equal(
    resolveTransitionStageMinHeight({
      isTransitionActive: true,
      snapshotHeight: 1680,
      viewportHeight: 900,
    }),
    1680,
  );
});

test("resolveTransitionStageMinHeight falls back to a viewport-safe floor when the captured stage is short", () => {
  assert.equal(
    resolveTransitionStageMinHeight({
      isTransitionActive: true,
      snapshotHeight: 180,
      viewportHeight: 900,
    }),
    868,
  );
});

test("resolveWaitingContentMotion keeps the main content in place while waiting for the target route", () => {
  assert.deepEqual(resolveWaitingContentMotion({ isWaitingForTarget: true }), {
    opacity: 0.14,
    x: 0,
    scale: 0.985,
    filter: "blur(4px)",
  });
});

test("app frame keeps a locked main-stage min-height while a route transition is active", () => {
  const frameSource = readFileSync(join(process.cwd(), "src/components/site/frame.tsx"), "utf8");

  assert.match(frameSource, /resolveTransitionStageMinHeight/);
  assert.match(frameSource, /style=\{\{ minHeight: transitionStageMinHeight \?\? undefined \}\}/);
});

test("app frame reuses a waiting-content motion preset instead of applying vertical drift during route loading", () => {
  const frameSource = readFileSync(join(process.cwd(), "src/components/site/frame.tsx"), "utf8");

  assert.match(frameSource, /resolveWaitingContentMotion/);
  assert.match(frameSource, /const waitingContentMotion = useMemo/);
  assert.match(frameSource, /animate=\{waitingContentMotion\}/);
});

test("loading shell can stretch to inherit a transition stage height lock", () => {
  const globalStyles = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  assert.match(globalStyles, /\.page-loading-shell\s*\{[^}]*min-height:\s*max\(calc\(100svh - 5rem\), 100%\);/s);
  assert.match(globalStyles, /\.loading-board\s*\{[^}]*min-height:\s*inherit;/s);
});
