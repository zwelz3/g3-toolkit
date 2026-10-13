/**
 * The derived-property expression language (GHSA-mpfx-v932-r2fv):
 * what it evaluates, and what it must refuse.
 */
import { describe, expect, it } from "vitest";
import { UGM } from "../ugm";
import { DerivedPropertyEngine } from "./advanced";
import {
  ExpressionError,
  MAX_DEPTH,
  MAX_LENGTH,
  evaluateExpression,
  parseExpression,
} from "./expression";

const run = (src: string, scope: Record<string, number> = {}) =>
  evaluateExpression(parseExpression(src), new Map(Object.entries(scope)));

describe("expression language: what it evaluates", () => {
  it.each([
    ["1 + 2 * 3", 7],
    ["(1 + 2) * 3", 9],
    ["10 % 4", 2],
    ["2 ^ 3 ^ 2", 512], // right-associative
    ["-2 ^ 2", -4], // power binds tighter than unary minus
    ["2 ^ -1", 0.5],
    ["--3", 3],
    [".5 + 1e-1", 0.6],
    ["x * 2 + y", 11],
    ["sqrt(x * 4)", 4],
    ["max(x, y, 10)", 10],
    ["min(x, y)", 3],
    ["atan2(1, 1) * 4", Math.PI],
    ["round(PI * 100) / 100", 3.14],
    ["x > 2 ? 1 : 0", 1],
    ["x > 2 and y < 3 ? 1 : 0", 0],
    ["x > 2 or y < 3 ? 1 : 0", 1],
    ["not (x == 4) ? 10 : 20", 20],
    ["not (x == 3) ? 10 : 20", 10],
    ["x != y ? E : 0", Math.E],
  ])("%s", (src, expected) => {
    expect(run(src, { x: 4, y: 3 })).toBeCloseTo(expected as number, 10);
  });

  it("returns a boolean for a bare comparison", () => {
    expect(run("x >= 4", { x: 4 })).toBe(true);
  });

  it("reports the variables an expression reads", () => {
    expect(
      [...parseExpression("risk * 100 + score / risk").variables].sort(),
    ).toEqual(["risk", "score"]);
  });

  it("throws for a missing variable", () => {
    expect(() => run("x + z", { x: 1 })).toThrow(ExpressionError);
  });
});

describe("expression language: what it refuses", () => {
  it.each([
    ["member access", "x.constructor"],
    ["chained member access", "x.constructor.constructor"],
    ["indexing", 'x["constructor"]'],
    ["assignment", "x = 1"],
    ["function definition", "f(a) = a"],
    ["a string literal", '"abc"'],
    ["a single-quoted string", "'abc'"],
    ["an unknown function", "eval(1)"],
    ["a non-allow-listed Math member", "random()"],
    ["a call through a variable", "x(1)"],
    ["concatenation", "x || 1"],
    ["factorial", "3!"],
    ["the in operator", "x in y"],
    ["an array literal", "[1, 2]"],
    ["a semicolon sequence", "x; 1"],
    ["a dangling operator", "1 +"],
    ["an unclosed group", "(1 + 2"],
    ["empty input", ""],
  ])("%s: %s", (_label, src) => {
    expect(() => run(src, { x: 1, y: 2 })).toThrow(ExpressionError);
  });

  it.each([
    "constructor",
    "__proto__",
    "toString",
    "prototype",
    "hasOwnProperty",
  ])(
    "a prototype name (%s) is an unknown variable, not an object member",
    (name) => {
      expect(() => run(name)).toThrow(ExpressionError);
      expect(() => run(`${name}(1)`)).toThrow(ExpressionError);
    },
  );

  it(`rejects input longer than ${MAX_LENGTH} characters`, () => {
    const src = Array.from({ length: 600 }, () => "1").join("+");
    expect(src.length).toBeGreaterThan(MAX_LENGTH);
    expect(() => parseExpression(src)).toThrow(/longer than/);
  });

  it(`rejects nesting deeper than ${MAX_DEPTH}`, () => {
    const src = "(".repeat(MAX_DEPTH + 1) + "1" + ")".repeat(MAX_DEPTH + 1);
    expect(src.length).toBeLessThan(MAX_LENGTH);
    expect(() => parseExpression(src)).toThrow(/nested deeper/);
    expect(() => parseExpression("-".repeat(MAX_DEPTH + 1) + "1")).toThrow(
      /nested deeper/,
    );
  });

  it("accepts nesting at the limit", () => {
    const depthOk = Math.floor(MAX_DEPTH / 2) - 1;
    expect(run("(".repeat(depthOk) + "1" + ")".repeat(depthOk))).toBe(1);
  });
});

describe("DerivedPropertyEngine with hostile expressions", () => {
  it("writes nothing and pollutes no prototype", () => {
    const ugm = new UGM();
    ugm.addNode("n1", { types: ["X"], properties: { x: 2 } });
    const engine = new DerivedPropertyEngine();
    const hostile = [
      "x.constructor.constructor",
      "constructor",
      "__proto__",
      "x = 1",
      "f(a) = a",
      'x["__proto__"]',
      "toString(1)",
    ];
    hostile.forEach((expression, i) =>
      engine.define({ name: `h${i}`, expression, reactive: false }),
    );
    engine.define({ name: "ok", expression: "x * 3", reactive: false });

    expect(() => engine.compute(ugm)).not.toThrow();
    const props = ugm.getNode("n1")?.properties ?? {};
    expect(props.ok).toBe(6);
    hostile.forEach((_, i) => expect(props).not.toHaveProperty(`h${i}`));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "x")).toBe(
      false,
    );
  });

  it("skips a node whose property value is not a number", () => {
    const ugm = new UGM();
    ugm.addNode("n1", {
      types: ["X"],
      properties: { x: "3" as unknown as number },
    });
    const engine = new DerivedPropertyEngine();
    engine.define({ name: "y", expression: "x + 1", reactive: false });
    engine.compute(ugm);
    expect(ugm.getNode("n1")?.properties).not.toHaveProperty("y");
  });
});
