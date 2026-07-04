/**
 * A curated in-browser SPARQL SELECT executor. This is deliberately a SUBSET,
 * not a conformant engine: it parses PREFIX declarations, SELECT (DISTINCT)?
 * with a variable list or *, a WHERE block of basic triple patterns (with the
 * `;` and `,` abbreviations and the `a` keyword), optional FILTER comparisons
 * and regex, ORDER BY, and LIMIT. It evaluates the basic graph pattern by
 * nested-loop join over the triples. It is enough to drive the demo's default
 * queries and light ad-hoc exploration; the shell surfaces a notice that a
 * production deployment should bundle a real SPARQL engine (Comunica, Oxigraph
 * via WASM, or a remote endpoint via the toolkit's SparqlAdapter) rather than
 * rely on this. Keeping it small and pure also makes it fully testable.
 */
import type { RDFTriple, RDFGraph } from "@g3t/core";

export type Term =
  | { kind: "var"; name: string }
  | { kind: "uri"; value: string }
  | { kind: "literal"; value: string; datatype?: string; language?: string };

interface TriplePattern {
  s: Term;
  p: Term;
  o: Term;
}
type CompareOp = ">" | "<" | ">=" | "<=" | "=" | "!=";
type Filter =
  | { kind: "compare"; op: CompareOp; left: Term; right: Term }
  | { kind: "regex"; term: Term; pattern: string; flags: string };

interface ParsedQuery {
  prefixes: Record<string, string>;
  distinct: boolean;
  vars: string[] | "*";
  patterns: TriplePattern[];
  filters: Filter[];
  orderBy?: { name: string; desc: boolean };
  limit?: number;
}

export type Binding = Record<string, Term>;
export type SparqlResult =
  | { ok: true; head: string[]; rows: Binding[] }
  | { ok: false; error: string };

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const BUILTIN_PREFIXES: Record<string, string> = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  ex: "http://example.org/bio#",
};
const NUMERIC_DT = new Set([
  "http://www.w3.org/2001/XMLSchema#integer",
  "http://www.w3.org/2001/XMLSchema#decimal",
  "http://www.w3.org/2001/XMLSchema#double",
  "http://www.w3.org/2001/XMLSchema#float",
]);

// ── Tokenizer ──────────────────────────────────────────────────────────────

function tokenize(q: string): string[] {
  const tokens: string[] = [];
  const n = q.length;
  let i = 0;
  const isWordEnd = (ch: string) => ch === "" || /[\s{}().;,<>"'?$]/.test(ch);
  while (i < n) {
    const c = q.charAt(i);
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "#") {
      while (i < n && q.charAt(i) !== "\n") i += 1;
      continue;
    }
    if (c === "<") {
      let j = i + 1;
      while (j < n && q.charAt(j) !== ">") j += 1;
      tokens.push(q.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = c;
      while (j < n && q.charAt(j) !== c) {
        s += q.charAt(j);
        j += 1;
      }
      s += c;
      j += 1;
      if (q.charAt(j) === "^" && q.charAt(j + 1) === "^") {
        s += "^^";
        j += 2;
        if (q.charAt(j) === "<") {
          let k = j + 1;
          while (k < n && q.charAt(k) !== ">") k += 1;
          s += q.slice(j, k + 1);
          j = k + 1;
        } else {
          let k = j;
          while (k < n && !isWordEnd(q.charAt(k))) k += 1;
          s += q.slice(j, k);
          j = k;
        }
      } else if (q.charAt(j) === "@") {
        let k = j;
        while (k < n && !isWordEnd(q.charAt(k))) k += 1;
        s += q.slice(j, k);
        j = k;
      }
      tokens.push(s);
      i = j;
      continue;
    }
    if (c === "?" || c === "$") {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(q.charAt(j))) j += 1;
      tokens.push(q.slice(i, j));
      i = j;
      continue;
    }
    if ("{}().;,".includes(c)) {
      tokens.push(c);
      i += 1;
      continue;
    }
    if (">=<!".includes(c)) {
      if (q.charAt(i + 1) === "=") {
        tokens.push(c + "=");
        i += 2;
      } else {
        tokens.push(c);
        i += 1;
      }
      continue;
    }
    let j = i;
    while (j < n && !isWordEnd(q.charAt(j)) && !">=<!".includes(q.charAt(j)))
      j += 1;
    tokens.push(q.slice(i, j));
    i = j;
  }
  return tokens;
}

// ── Parser ───────────────────────────────────────────────────────────────

function parseTerm(token: string, prefixes: Record<string, string>): Term {
  if (token === "") throw new Error("unexpected end of query");
  if (token.startsWith("?") || token.startsWith("$"))
    return { kind: "var", name: token.slice(1) };
  if (token === "a") return { kind: "uri", value: RDF_TYPE };
  if (token.startsWith("<") && token.endsWith(">"))
    return { kind: "uri", value: token.slice(1, -1) };
  if (token.startsWith('"') || token.startsWith("'")) {
    const quote = token.charAt(0);
    const end =
      token.lastIndexOf(quote, token.length - 1) > 0
        ? token.indexOf(quote, 1)
        : token.length - 1;
    const value = token.slice(1, end);
    const rest = token.slice(end + 1);
    if (rest.startsWith("^^")) {
      const dt = rest.slice(2);
      return {
        kind: "literal",
        value,
        datatype: dt.startsWith("<")
          ? dt.slice(1, -1)
          : expandPrefixed(dt, prefixes),
      };
    }
    if (rest.startsWith("@"))
      return { kind: "literal", value, language: rest.slice(1) };
    return { kind: "literal", value };
  }
  if (/^[+-]?\d+(\.\d+)?$/.test(token)) {
    return {
      kind: "literal",
      value: token,
      datatype: token.includes(".")
        ? BUILTIN_PREFIXES.xsd + "decimal"
        : BUILTIN_PREFIXES.xsd + "integer",
    };
  }
  if (token.includes(":"))
    return { kind: "uri", value: expandPrefixed(token, prefixes) };
  return { kind: "literal", value: token };
}

function expandPrefixed(
  token: string,
  prefixes: Record<string, string>,
): string {
  const idx = token.indexOf(":");
  if (idx < 0) return token;
  const prefix = token.slice(0, idx);
  const local = token.slice(idx + 1);
  const ns = prefixes[prefix] ?? BUILTIN_PREFIXES[prefix];
  return ns ? ns + local : token;
}

function parseQuery(query: string): ParsedQuery {
  const tokens = tokenize(query);
  let pos = 0;
  const peek = (): string => tokens[pos] ?? "";
  const next = (): string => tokens[pos++] ?? "";
  const expect = (t: string): void => {
    if (peek().toUpperCase() !== t.toUpperCase())
      throw new Error(
        `expected "${t}" but found "${peek() || "end of query"}"`,
      );
    pos += 1;
  };

  const prefixes: Record<string, string> = { ...BUILTIN_PREFIXES };
  while (peek().toUpperCase() === "PREFIX") {
    next();
    const label = next().replace(/:$/, "");
    const iri = next();
    prefixes[label] = iri.startsWith("<") ? iri.slice(1, -1) : iri;
  }

  expect("SELECT");
  let distinct = false;
  if (peek().toUpperCase() === "DISTINCT") {
    distinct = true;
    next();
  }
  let vars: string[] | "*";
  if (peek() === "*") {
    vars = "*";
    next();
  } else {
    const list: string[] = [];
    while (peek().startsWith("?") || peek().startsWith("$"))
      list.push(next().slice(1));
    if (list.length === 0)
      throw new Error("SELECT needs at least one variable or *");
    vars = list;
  }

  expect("WHERE");
  expect("{");
  const patterns: TriplePattern[] = [];
  const filters: Filter[] = [];
  parseGroup(patterns, filters);

  const parsed: ParsedQuery = { prefixes, distinct, vars, patterns, filters };

  if (peek().toUpperCase() === "ORDER") {
    next();
    expect("BY");
    let desc = false;
    if (peek().toUpperCase() === "ASC" || peek().toUpperCase() === "DESC") {
      desc = next().toUpperCase() === "DESC";
      expect("(");
    }
    const v = next();
    if (desc) expect(")");
    parsed.orderBy = { name: v.replace(/^[?$]/, ""), desc };
  }
  if (peek().toUpperCase() === "LIMIT") {
    next();
    const n = Number(next());
    if (Number.isFinite(n)) parsed.limit = n;
  }
  return parsed;

  function parseGroup(pats: TriplePattern[], filts: Filter[]): void {
    while (peek() !== "}" && peek() !== "") {
      if (peek().toUpperCase() === "FILTER") {
        filts.push(parseFilter());
        if (peek() === ".") next();
        continue;
      }
      const subject = parseTerm(next(), prefixes);
      parsePredicateObjectList(subject, pats);
      if (peek() === ".") next();
    }
    if (peek() === "}") next();
    else throw new Error("unterminated WHERE block: expected }");
  }

  function parsePredicateObjectList(
    subject: Term,
    pats: TriplePattern[],
  ): void {
    for (;;) {
      const predicate = parseTerm(next(), prefixes);
      for (;;) {
        const object = parseTerm(next(), prefixes);
        pats.push({ s: subject, p: predicate, o: object });
        if (peek() === ",") {
          next();
          continue;
        }
        break;
      }
      if (peek() === ";") {
        next();
        if (peek() === "." || peek() === "}") break;
        continue;
      }
      break;
    }
  }

  function parseFilter(): Filter {
    next(); // FILTER
    expect("(");
    if (peek().toLowerCase() === "regex") {
      next();
      expect("(");
      const term = parseTerm(next(), prefixes);
      expect(",");
      const patTok = next();
      const pattern = patTok.replace(/^["']|["']$/g, "");
      let flags = "";
      if (peek() === ",") {
        next();
        flags = next().replace(/^["']|["']$/g, "");
      }
      expect(")");
      expect(")");
      return { kind: "regex", term, pattern, flags };
    }
    const left = parseTerm(next(), prefixes);
    const op = next() as CompareOp;
    const right = parseTerm(next(), prefixes);
    expect(")");
    return { kind: "compare", op, left, right };
  }
}

// ── Evaluation ─────────────────────────────────────────────────────────────

function positionValue(triple: RDFTriple, pos: "s" | "p" | "o"): Term {
  if (pos === "s") return { kind: "uri", value: triple.subject };
  if (pos === "p") return { kind: "uri", value: triple.predicate };
  return triple.objectType === "uri"
    ? { kind: "uri", value: triple.object }
    : {
        kind: "literal",
        value: triple.object,
        datatype: triple.datatype,
        language: triple.language,
      };
}

function termEqual(a: Term, b: Term): boolean {
  if (a.kind === "var" || b.kind === "var") return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "uri" && b.kind === "uri") return a.value === b.value;
  if (a.kind === "literal" && b.kind === "literal") return a.value === b.value;
  return false;
}

function unify(term: Term, value: Term, binding: Binding): Binding | null {
  if (term.kind === "var") {
    const existing = binding[term.name];
    if (existing) return termEqual(existing, value) ? binding : null;
    return { ...binding, [term.name]: value };
  }
  return termEqual(term, value) ? binding : null;
}

function matchPattern(
  pattern: TriplePattern,
  triple: RDFTriple,
  binding: Binding,
): Binding | null {
  const b1 = unify(pattern.s, positionValue(triple, "s"), binding);
  if (!b1) return null;
  const b2 = unify(pattern.p, positionValue(triple, "p"), b1);
  if (!b2) return null;
  return unify(pattern.o, positionValue(triple, "o"), b2);
}

function numericValue(term: Term): number | undefined {
  if (term.kind !== "literal") return undefined;
  if (term.datatype && !NUMERIC_DT.has(term.datatype)) return undefined;
  const n = Number(term.value);
  return Number.isFinite(n) ? n : undefined;
}

function passesFilter(filter: Filter, binding: Binding): boolean {
  if (filter.kind === "regex") {
    const t =
      filter.term.kind === "var" ? binding[filter.term.name] : filter.term;
    if (!t) return false;
    try {
      return new RegExp(filter.pattern, filter.flags).test(termText(t));
    } catch {
      return false;
    }
  }
  const left =
    filter.left.kind === "var" ? binding[filter.left.name] : filter.left;
  const right =
    filter.right.kind === "var" ? binding[filter.right.name] : filter.right;
  if (!left || !right) return false;
  const ln = numericValue(left);
  const rn = numericValue(right);
  if (ln !== undefined && rn !== undefined)
    return compareNumbers(ln, rn, filter.op);
  return compareStrings(termText(left), termText(right), filter.op);
}

function compareNumbers(a: number, b: number, op: CompareOp): boolean {
  switch (op) {
    case ">":
      return a > b;
    case "<":
      return a < b;
    case ">=":
      return a >= b;
    case "<=":
      return a <= b;
    case "=":
      return a === b;
    case "!=":
      return a !== b;
  }
}
function compareStrings(a: string, b: string, op: CompareOp): boolean {
  switch (op) {
    case ">":
      return a > b;
    case "<":
      return a < b;
    case ">=":
      return a >= b;
    case "<=":
      return a <= b;
    case "=":
      return a === b;
    case "!=":
      return a !== b;
  }
}

/** Display / value text of a term (URI value or literal lexical form). */
export function termText(term: Term): string {
  return term.kind === "var" ? `?${term.name}` : term.value;
}

/** Numeric value of a bound term, when it is a numeric literal. */
export function termNumber(term: Term): number | undefined {
  return numericValue(term);
}

export function executeSparql(graph: RDFGraph, query: string): SparqlResult {
  let parsed: ParsedQuery;
  try {
    parsed = parseQuery(query);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let bindings: Binding[] = [{}];
  for (const pattern of parsed.patterns) {
    const nextBindings: Binding[] = [];
    for (const binding of bindings) {
      for (const triple of graph.triples) {
        const matched = matchPattern(pattern, triple, binding);
        if (matched) nextBindings.push(matched);
      }
    }
    bindings = nextBindings;
    if (bindings.length === 0) break;
  }

  for (const filter of parsed.filters) {
    bindings = bindings.filter((b) => passesFilter(filter, b));
  }

  const head =
    parsed.vars === "*"
      ? [...new Set(bindings.flatMap((b) => Object.keys(b)))]
      : parsed.vars;

  if (parsed.orderBy) {
    const { name, desc } = parsed.orderBy;
    bindings = [...bindings].sort((a, b) => {
      const ta = a[name];
      const tb = b[name];
      if (!ta || !tb) return 0;
      const na = numericValue(ta);
      const nb = numericValue(tb);
      const cmp =
        na !== undefined && nb !== undefined
          ? na - nb
          : termText(ta).localeCompare(termText(tb));
      return desc ? -cmp : cmp;
    });
  }

  let rows: Binding[] = bindings.map((b) => {
    const row: Binding = {};
    for (const v of head) {
      const t = b[v];
      if (t) row[v] = t;
    }
    return row;
  });

  if (parsed.distinct) {
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      const key = head
        .map((v) => {
          const t = r[v];
          return t ? `${t.kind}:${termText(t)}` : "";
        })
        .join("\u0000");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (parsed.limit !== undefined) rows = rows.slice(0, parsed.limit);

  return { ok: true, head, rows };
}
