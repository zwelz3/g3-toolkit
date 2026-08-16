// Side-effect CSS entry point (@g3t/react/style.css).
//
// Under node16/nodenext resolution TypeScript rejects a side-effect
// import whose specifier has no declaration (TS2882), so a consumer
// following the documented first line of the quickstart could not
// compile. This declaration exists solely so that import resolves;
// the stylesheet itself is dist/style.css.
// `unknown`, not `void`: `void` means "the absence of a returned value"
// and is not a legal type for a value binding, so exporting a `void`
// const both misstates the shape and trips no-invalid-void-type. Either
// way a consumer cannot read a property off it, which is the point.
declare const styles: unknown;
export default styles;
