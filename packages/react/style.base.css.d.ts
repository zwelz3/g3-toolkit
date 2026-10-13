// Side-effect CSS entry point (@g3-toolkit/react/style.base.css): the
// OPT-IN page reset and body typography that style.css no longer
// carries (see src/theme/g3t-page.css for why). Same shape as
// style.css.d.ts: under node16/nodenext resolution TypeScript rejects a
// side-effect import whose specifier has no declaration (TS2882), so
// this declaration exists solely so that import resolves; the
// stylesheet itself is dist/style.base.css.
declare const styles: unknown;
export default styles;
