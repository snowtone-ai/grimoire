/**
 * build.mjs — bundles the prototype three ways from one source.
 *
 *   dist/area1-coral.js   IIFE bundle, loaded by index.html during development
 *   dist/standalone.html  one self-contained file (no network at all) — hand this to
 *                         anyone who just wants to open it
 *   dist/artifact.html    head+body fragment for publishing, with no <html>/<head>/<body>
 *                         wrapper and no external requests (a strict CSP blocks those)
 *
 * IIFE rather than ESM so `file://` works without a server.
 */

import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

const section = (html, name) => {
  const match = html.match(new RegExp(`<!-- ${name}:START -->([\\s\\S]*?)<!-- ${name}:END -->`));
  if (!match) throw new Error(`index.html is missing the ${name} section markers`);
  return match[1].trim();
};

async function main() {
  const minify = !process.argv.includes('--no-minify');
  await mkdir(dist, { recursive: true });

  const result = await esbuild.build({
    entryPoints: [join(root, 'src', 'main.js')],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    platform: 'browser',
    minify,
    legalComments: 'none',
    write: false,
    logLevel: 'info',
  });

  const bundle = result.outputFiles[0].text;
  await writeFile(join(dist, 'area1-coral.js'), bundle, 'utf8');

  const indexHtml = await readFile(join(root, 'index.html'), 'utf8');
  const head = section(indexHtml, 'HEAD');
  const body = section(indexHtml, 'BODY');
  // Inline scripts must not be terminated early by a literal </script> inside the bundle.
  const inlineScript = `<script>\n${bundle.replace(/<\/script>/gi, '<\\/script>')}\n</script>`;

  const standalone = `<!doctype html>
<html lang="ja">
<head>
${head}
</head>
<body>
${body}
${inlineScript}
</body>
</html>
`;
  await writeFile(join(dist, 'standalone.html'), standalone, 'utf8');

  // The publishing target supplies its own document skeleton and a minimal CSS reset.
  const artifact = `${head.replace(/<meta charset=[^>]*>\s*/i, '')}
${body}
${inlineScript}
`;
  await writeFile(join(dist, 'artifact.html'), artifact, 'utf8');

  const sizes = await Promise.all(
    ['area1-coral.js', 'standalone.html', 'artifact.html'].map(async (name) => {
      const s = await stat(join(dist, name));
      return `  ${name.padEnd(20)} ${(s.size / 1024).toFixed(0)} KB`;
    })
  );
  console.log(`\nbuilt (${minify ? 'minified' : 'unminified'}):\n${sizes.join('\n')}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
