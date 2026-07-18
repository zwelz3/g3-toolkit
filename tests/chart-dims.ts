/**
 * Opt-in jsdom dimension stub for tests that mount ECharts.
 *
 * jsdom elements report clientWidth/clientHeight of 0, so echarts
 * warns "Can't get DOM width or height" on every chart mount. This
 * gives elements a nonzero size for the duration of a test FILE that
 * opts in (call stubChartDims() at module scope). Deliberately not
 * global setup: a universal size stub could mask real layout logic
 * in non-chart tests.
 */
import { beforeAll, afterAll } from "vitest";

export function stubChartDims(width = 800, height = 600): void {
  let prevW: PropertyDescriptor | undefined;
  let prevH: PropertyDescriptor | undefined;
  beforeAll(() => {
    prevW = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    prevH = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => width,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => height,
    });
  });
  afterAll(() => {
    if (prevW)
      Object.defineProperty(HTMLElement.prototype, "clientWidth", prevW);
    else Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
    if (prevH)
      Object.defineProperty(HTMLElement.prototype, "clientHeight", prevH);
    else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  });
}
