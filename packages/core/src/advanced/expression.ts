/**
 * Numeric expression language for derived properties.
 *
 * Replaces expr-eval (GHSA-mpfx-v932-r2fv). The engine's contract is
 * numbers in, a finite number out, so the language holds only what that
 * contract needs:
 *
 *   - numbers (`12`, `0.5`, `.5`, `1e-3`) and the constants `PI` and `E`;
 *   - variables: the names of the node's own numeric properties, looked
 *     up in a Map, never through an object's prototype chain;
 *   - `+ - * / % ^` (power, right-associative), unary `-` and `+`;
 *   - comparison `== != < <= > >=`, logic `and or not`, and `a ? b : c`;
 *   - calls to a fixed allow-list of Math functions (FUNCTIONS below).
 *
 * There is no member access, no indexing, no assignment, no function
 * definition, no strings, and no call through a variable. Input is
 * bounded (MAX_LENGTH characters, MAX_DEPTH nesting) so a hostile
 * expression cannot exhaust the stack. Parse once with `parseExpression`
 * and evaluate per node with `evaluateExpression`; both throw
 * `ExpressionError` on anything outside the language.
 *
 * Internal to @g3-toolkit/core: not exported from the package.
 */

export class ExpressionError extends Error {
  override name = "ExpressionError";
}

export const MAX_LENGTH = 1000;
export const MAX_DEPTH = 64;

const FUNCTIONS: ReadonlyMap<string, (...args: number[]) => number> = new Map<
  string,
  (...args: number[]) => number
>([
  ["abs", Math.abs],
  ["acos", Math.acos],
  ["acosh", Math.acosh],
  ["asin", Math.asin],
  ["asinh", Math.asinh],
  ["atan", Math.atan],
  ["atan2", Math.atan2],
  ["atanh", Math.atanh],
  ["cbrt", Math.cbrt],
  ["ceil", Math.ceil],
  ["cos", Math.cos],
  ["cosh", Math.cosh],
  ["exp", Math.exp],
  ["expm1", Math.expm1],
  ["floor", Math.floor],
  ["hypot", Math.hypot],
  ["lg", Math.log10],
  ["ln", Math.log],
  ["log", Math.log],
  ["log10", Math.log10],
  ["log1p", Math.log1p],
  ["log2", Math.log2],
  ["max", Math.max],
  ["min", Math.min],
  ["pow", Math.pow],
  ["round", Math.round],
  ["sign", Math.sign],
  ["sin", Math.sin],
  ["sinh", Math.sinh],
  ["sqrt", Math.sqrt],
  ["tan", Math.tan],
  ["tanh", Math.tanh],
  ["trunc", Math.trunc],
]);

const CONSTANTS: ReadonlyMap<string, number> = new Map([
  ["PI", Math.PI],
  ["E", Math.E],
]);

const KEYWORDS = new Set(["and", "or", "not"]);

type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "unary"; op: "-" | "+" | "not"; arg: Node }
  | { k: "binary"; op: string; left: Node; right: Node }
  | { k: "cond"; test: Node; then: Node; else: Node }
  | { k: "call"; fn: (...args: number[]) => number; args: Node[] };

/** A parsed expression: evaluate it with `evaluateExpression`. */
export interface Expression {
  readonly root: Node;
  /** Every variable name the expression reads. */
  readonly variables: ReadonlySet<string>;
}

type Token =
  | { t: "num"; v: number; at: number }
  | { t: "id"; v: string; at: number }
  | { t: "op"; v: string; at: number }
  | { t: "end"; at: number };

const OPERATORS = [
  "==",
  "!=",
  "<=",
  ">=",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "(",
  ")",
  ",",
  "?",
  ":",
];

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: "num", v: Number(num[0]), at: i });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: "id", v: id[0], at: i });
      i += id[0].length;
      continue;
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ t: "op", v: op, at: i });
      i += op.length;
      continue;
    }
    throw new ExpressionError(`Unexpected character "${c}" at ${i}`);
  }
  out.push({ t: "end", at: src.length });
  return out;
}

/** Parse an expression. Throws ExpressionError when it is outside the language. */
export function parseExpression(src: string): Expression {
  if (typeof src !== "string")
    throw new ExpressionError("Expression must be a string");
  if (src.length > MAX_LENGTH)
    throw new ExpressionError(
      `Expression longer than ${MAX_LENGTH} characters`,
    );
  const tokens = tokenize(src);
  const variables = new Set<string>();
  let pos = 0;
  let depth = 0;

  const peek = (): Token => tokens[pos] ?? { t: "end", at: src.length };
  const isOp = (v: string) => {
    const t = peek();
    return t.t === "op" && t.v === v;
  };
  const isWord = (v: string) => {
    const t = peek();
    return t.t === "id" && t.v === v;
  };
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new ExpressionError(`Expected "${v}" at ${peek().at}`);
    pos++;
  };
  const nest = <T>(f: () => T): T => {
    if (++depth > MAX_DEPTH)
      throw new ExpressionError(`Expression nested deeper than ${MAX_DEPTH}`);
    try {
      return f();
    } finally {
      depth--;
    }
  };

  // Precedence, loosest first: ?:, or, and, comparison, + -, * / %, unary, ^.
  const conditional = (): Node =>
    nest(() => {
      const test = or();
      if (!isOp("?")) return test;
      pos++;
      const then = conditional();
      expectOp(":");
      return { k: "cond", test, then, else: conditional() };
    });
  const or = (): Node => {
    let left = and();
    while (isWord("or")) {
      pos++;
      left = { k: "binary", op: "or", left, right: and() };
    }
    return left;
  };
  const and = (): Node => {
    let left = comparison();
    while (isWord("and")) {
      pos++;
      left = { k: "binary", op: "and", left, right: comparison() };
    }
    return left;
  };
  const comparison = (): Node => {
    let left = additive();
    for (;;) {
      const t = peek();
      if (t.t === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(t.v)) {
        pos++;
        left = { k: "binary", op: t.v, left, right: additive() };
      } else return left;
    }
  };
  const additive = (): Node => {
    let left = multiplicative();
    for (;;) {
      const t = peek();
      if (t.t === "op" && (t.v === "+" || t.v === "-")) {
        pos++;
        left = { k: "binary", op: t.v, left, right: multiplicative() };
      } else return left;
    }
  };
  const multiplicative = (): Node => {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t.t === "op" && (t.v === "*" || t.v === "/" || t.v === "%")) {
        pos++;
        left = { k: "binary", op: t.v, left, right: unary() };
      } else return left;
    }
  };
  const unary = (): Node =>
    nest(() => {
      if (isOp("-") || isOp("+")) {
        const op = (peek() as { v: "-" | "+" }).v;
        pos++;
        return { k: "unary", op, arg: unary() };
      }
      if (isWord("not")) {
        pos++;
        return { k: "unary", op: "not", arg: unary() };
      }
      return power();
    });
  // `-2^2` is -(2^2), and the exponent may carry its own sign (`2^-1`).
  const power = (): Node => {
    const base = primary();
    if (!isOp("^")) return base;
    pos++;
    return { k: "binary", op: "^", left: base, right: unary() };
  };
  const primary = (): Node => {
    const t = peek();
    if (t.t === "num") {
      pos++;
      return { k: "num", v: t.v };
    }
    if (t.t === "op" && t.v === "(") {
      pos++;
      const inner = conditional();
      expectOp(")");
      return inner;
    }
    if (t.t === "id") {
      if (KEYWORDS.has(t.v))
        throw new ExpressionError(`Unexpected "${t.v}" at ${t.at}`);
      pos++;
      if (isOp("(")) {
        const fn = FUNCTIONS.get(t.v);
        if (!fn)
          throw new ExpressionError(`Unknown function "${t.v}" at ${t.at}`);
        pos++;
        const args: Node[] = [];
        if (!isOp(")")) {
          for (;;) {
            args.push(conditional());
            if (!isOp(",")) break;
            pos++;
          }
        }
        expectOp(")");
        return { k: "call", fn, args };
      }
      const c = CONSTANTS.get(t.v);
      if (c !== undefined) return { k: "num", v: c };
      variables.add(t.v);
      return { k: "var", name: t.v };
    }
    throw new ExpressionError(
      t.t === "end"
        ? "Unexpected end of expression"
        : `Unexpected "${t.v}" at ${t.at}`,
    );
  };

  const root = conditional();
  if (peek().t !== "end")
    throw new ExpressionError(
      `Unexpected "${(peek() as { v: string }).v}" at ${peek().at}`,
    );
  return { root, variables };
}

type Value = number | boolean;

const num = (v: Value): number => {
  if (typeof v !== "number") throw new ExpressionError("Expected a number");
  return v;
};
const truthy = (v: Value): boolean =>
  typeof v === "boolean" ? v : v !== 0 && !Number.isNaN(v);

/**
 * Evaluate a parsed expression against one node's numeric properties.
 * Throws ExpressionError when a variable is missing or a value has the
 * wrong type; the result is a number or a boolean (a comparison).
 */
export function evaluateExpression(
  expr: Expression,
  scope: ReadonlyMap<string, number>,
): Value {
  const ev = (n: Node): Value => {
    switch (n.k) {
      case "num":
        return n.v;
      case "var": {
        const v = scope.get(n.name);
        if (v === undefined)
          throw new ExpressionError(`No value for "${n.name}"`);
        return v;
      }
      case "unary": {
        const a = ev(n.arg);
        if (n.op === "not") return !truthy(a);
        return n.op === "-" ? -num(a) : num(a);
      }
      case "cond":
        return truthy(ev(n.test)) ? ev(n.then) : ev(n.else);
      case "call":
        return n.fn(...n.args.map((a) => num(ev(a))));
      case "binary": {
        if (n.op === "and") return truthy(ev(n.left)) && truthy(ev(n.right));
        if (n.op === "or") return truthy(ev(n.left)) || truthy(ev(n.right));
        const l = ev(n.left);
        const r = ev(n.right);
        if (n.op === "==") return l === r;
        if (n.op === "!=") return l !== r;
        const a = num(l);
        const b = num(r);
        switch (n.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            return a / b;
          case "%":
            return a % b;
          case "^":
            return Math.pow(a, b);
          case "<":
            return a < b;
          case "<=":
            return a <= b;
          case ">":
            return a > b;
          case ">=":
            return a >= b;
        }
        throw new ExpressionError(`Unknown operator "${n.op}"`);
      }
    }
  };
  return ev(expr.root);
}
