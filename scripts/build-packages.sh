#!/bin/bash
# Build all three packages from the monolithic source tree.
# Each package gets its own dist/ with ESM + CJS + declarations.

set -e

echo "Building @g3t/core..."
npx vite build --config vite.lib.config.ts
echo "Core bundle complete."

echo ""
echo "Copying dist to packages/core/dist..."
rm -rf packages/core/dist
mkdir -p packages/core/dist
cp dist/g3t.mjs packages/core/dist/index.mjs
cp dist/g3t.cjs packages/core/dist/index.cjs
cp dist/g3t.mjs.map packages/core/dist/index.mjs.map 2>/dev/null || true
cp dist/g3t.cjs.map packages/core/dist/index.cjs.map 2>/dev/null || true

echo "Copying dist to packages/react/dist..."
rm -rf packages/react/dist
mkdir -p packages/react/dist
cp dist/g3t.mjs packages/react/dist/index.mjs
cp dist/g3t.cjs packages/react/dist/index.cjs
cp dist/g3-toolkit.css packages/react/dist/style.css 2>/dev/null || true

echo "Copying dist to packages/charts/dist..."
rm -rf packages/charts/dist
mkdir -p packages/charts/dist
cp dist/g3t.mjs packages/charts/dist/index.mjs
cp dist/g3t.cjs packages/charts/dist/index.cjs

echo ""
echo "Generating declarations..."
npx tsc -p tsconfig.build.json

echo "Copying declarations to packages..."
cp -r dist/core packages/core/dist/core 2>/dev/null || true
cp -r dist/views dist/interaction dist/state dist/theme dist/a11y packages/react/dist/ 2>/dev/null || true
cp -r dist/charts packages/charts/dist/charts 2>/dev/null || true
cp dist/index.d.ts packages/core/dist/ 2>/dev/null || true
cp dist/index.d.ts packages/react/dist/ 2>/dev/null || true
cp dist/index.d.ts packages/charts/dist/ 2>/dev/null || true

echo ""
echo "Build complete. Package sizes:"
du -sh packages/core/dist packages/react/dist packages/charts/dist 2>/dev/null
