/**
 * OverlayTransport (issue #20): the presentational face of
 * `useOverlaySequence`. It renders prev / play-pause / next, an index
 * readout ("3 of 7"), and optional speed and loop controls, each
 * individually suppressible so a host can reduce it to prev / play /
 * next. It holds no state: hand it the hook's result and, for the
 * optional controls, the host-owned speed and loop values with their
 * setters.
 *
 *   const sequence = useOverlaySequence({ ids, speedMs, loop });
 *   <OverlayTransport sequence={sequence}
 *     speedMs={speedMs} onSpeedChange={setSpeedMs}
 *     loop={loop} onLoopChange={setLoop} />
 *
 * Every control is a native button or select, so it is keyboard
 * operable without extra handling; each carries an aria-label, the
 * loop toggle carries aria-pressed, and the readout is a polite live
 * region so a screen reader hears the step change. Colors come from
 * g3t tokens only (OverlayTransport.css).
 */

import type { CSSProperties } from "react";
import { Icon } from "../../icons";
import type { OverlaySequence } from "./useOverlaySequence";
import "./OverlayTransport.css";

export interface OverlayTransportLabels {
  prev: string;
  next: string;
  play: string;
  pause: string;
  loop: string;
  speed: string;
  /** The index readout. Receives the 1-based step and the length. */
  readout: (step: number, length: number) => string;
}

const DEFAULT_LABELS: OverlayTransportLabels = {
  prev: "Previous step",
  next: "Next step",
  play: "Play",
  pause: "Pause",
  loop: "Loop",
  speed: "Step interval",
  readout: (step, length) => (length === 0 ? "0 of 0" : `${step} of ${length}`),
};

/** Interval choices offered by the speed control, in ms. */
export const DEFAULT_SPEED_OPTIONS: readonly number[] = [
  250, 500, 1000, 2000, 4000,
];

const formatSpeed = (ms: number): string =>
  ms >= 1000 ? `${Number((ms / 1000).toFixed(2))}s` : `${ms}ms`;

export interface OverlayTransportProps {
  /** The result of `useOverlaySequence`, or any object of that shape. */
  sequence: OverlaySequence;
  /** Current interval. The speed control renders only when BOTH this
   *  and `onSpeedChange` are provided (and `showSpeed` is not false). */
  speedMs?: number;
  onSpeedChange?: (speedMs: number) => void;
  /** Interval choices for the speed control. Default
   *  DEFAULT_SPEED_OPTIONS; the current `speedMs` is always offered. */
  speedOptions?: readonly number[];
  /** Current loop flag. The loop toggle renders only when BOTH this and
   *  `onLoopChange` are provided (and `showLoop` is not false). */
  loop?: boolean;
  onLoopChange?: (loop: boolean) => void;
  showPrev?: boolean;
  showNext?: boolean;
  showPlayPause?: boolean;
  showReadout?: boolean;
  showSpeed?: boolean;
  showLoop?: boolean;
  /** Override any accessible label or the readout text. */
  labels?: Partial<OverlayTransportLabels>;
  /** Accessible name of the whole group. Default "Overlay sequence". */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function OverlayTransport({
  sequence,
  speedMs,
  onSpeedChange,
  speedOptions = DEFAULT_SPEED_OPTIONS,
  loop,
  onLoopChange,
  showPrev = true,
  showNext = true,
  showPlayPause = true,
  showReadout = true,
  showSpeed = true,
  showLoop = true,
  labels,
  ariaLabel = "Overlay sequence",
  className,
  style,
}: OverlayTransportProps) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const { index, length, isPlaying } = sequence;
  const empty = length === 0;
  // Without loop the ends are hard stops, so the button that cannot
  // move is disabled rather than a silent no-op; with loop both always
  // move.
  const atStart = !loop && index <= 0;
  const atEnd = !loop && index >= length - 1;
  const speedControl =
    showSpeed && speedMs !== undefined && onSpeedChange !== undefined;
  const loopControl =
    showLoop && loop !== undefined && onLoopChange !== undefined;
  const options =
    speedMs !== undefined && !speedOptions.includes(speedMs)
      ? [...speedOptions, speedMs].sort((a, b) => a - b)
      : speedOptions;

  return (
    <div
      className={["g3t-overlay-transport", className].filter(Boolean).join(" ")}
      style={style}
      role="group"
      aria-label={ariaLabel}
      data-testid="overlay-transport"
    >
      {showPrev && (
        <button
          type="button"
          className="g3t-btn g3t-btn-ghost g3t-overlay-transport-btn"
          data-testid="overlay-transport-prev"
          aria-label={l.prev}
          title={l.prev}
          disabled={empty || atStart}
          onClick={sequence.prev}
        >
          <Icon name="chevron-left" size={14} />
        </button>
      )}
      {showPlayPause && (
        <button
          type="button"
          className="g3t-btn g3t-btn-ghost g3t-overlay-transport-btn"
          data-testid="overlay-transport-play"
          aria-label={isPlaying ? l.pause : l.play}
          title={isPlaying ? l.pause : l.play}
          disabled={empty}
          onClick={isPlaying ? sequence.pause : sequence.play}
        >
          <Icon name={isPlaying ? "pause" : "play"} size={14} />
        </button>
      )}
      {showNext && (
        <button
          type="button"
          className="g3t-btn g3t-btn-ghost g3t-overlay-transport-btn"
          data-testid="overlay-transport-next"
          aria-label={l.next}
          title={l.next}
          disabled={empty || atEnd}
          onClick={sequence.next}
        >
          <Icon name="chevron-right" size={14} />
        </button>
      )}
      {showReadout && (
        <span
          className="g3t-overlay-transport-readout"
          data-testid="overlay-transport-readout"
          aria-live="polite"
        >
          {l.readout(empty ? 0 : index + 1, length)}
        </span>
      )}
      {speedControl && (
        <select
          className="g3t-select g3t-overlay-transport-speed"
          data-testid="overlay-transport-speed"
          aria-label={l.speed}
          title={l.speed}
          value={speedMs}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
        >
          {options.map((ms) => (
            <option key={ms} value={ms}>
              {formatSpeed(ms)}
            </option>
          ))}
        </select>
      )}
      {loopControl && (
        <button
          type="button"
          className="g3t-btn g3t-btn-ghost g3t-overlay-transport-btn"
          data-testid="overlay-transport-loop"
          aria-label={l.loop}
          title={l.loop}
          aria-pressed={loop}
          onClick={() => onLoopChange(!loop)}
        >
          {l.loop}
        </button>
      )}
    </div>
  );
}
