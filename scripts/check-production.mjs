/* Post-deploy gate: does the CSS production actually serves still contain every
 * hand-written class globals.css defines?
 *
 * 由来: 2026-08-23 (T045/T046). The Production deployment for f8b5c85 reported
 * READY, served the new public/ assets byte-identically, shipped the new JS, and
 * even carried the Tailwind utilities that only the new components request — but
 * its CSS chunk was missing every hand-written class the branch had added.
 * Vercel had restored a build cache ("Restored build cache from previous
 * deployment") and Turbopack emitted a stale custom-CSS layer. The build logged
 * no error and no warning, CI was green, and the local production build was
 * correct, so nothing on the machine could see it: the home screen's add button
 * was an unstyled 300x150 canvas hanging off the corner of the page, in
 * production only. Re-deploying (any new commit) produced a correct build.
 *
 * Nothing that runs before the deploy can catch this, which is why it lives here
 * rather than in scripts/verify.mjs. Run it after a production deploy goes READY.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.argv[2] ?? process.env.PRODUCTION_URL ?? "https://task-plant.vercel.app";

/* Only column-0 selectors: an indented `.foo` is nested inside a media query,
 * @layer, or another rule, so its outermost selector is already covered. */
function definedClasses(css) {
  const names = new Set();
  for (const line of css.split("\n")) {
    const match = /^\.([A-Za-z][\w-]*)/.exec(line);
    if (match) names.add(match[1]);
  }
  return [...names];
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.text();
}

const html = await fetchText(`${SITE}/`);
const hrefs = [...new Set([...html.matchAll(/\/_next\/static\/[^"']+\.css/g)].map((m) => m[0]))];
if (hrefs.length === 0) throw new Error(`no stylesheet referenced by ${SITE}/ — is the deployment behind auth?`);

const served = (await Promise.all(hrefs.map((href) => fetchText(`${SITE}${href}`)))).join("\n");
const expected = definedClasses(await readFile(path.join(ROOT, "src", "app", "globals.css"), "utf8"));
const missing = expected.filter((name) => !served.includes(`.${name}`));

console.log(JSON.stringify({
  site: SITE,
  stylesheets: hrefs,
  servedBytes: served.length,
  classesDefined: expected.length,
  classesMissing: missing.length,
}, null, 2));

if (missing.length > 0) {
  console.error(
    `\nproduction CSS is missing ${missing.length} class(es) that globals.css defines:\n` +
      missing.map((name) => `  .${name}`).join("\n") +
      "\n\nThe deployment is stale even if Vercel reports READY. Re-deploy — any new\n" +
      "commit on main is enough — and run this again."
  );
  // exitCode rather than exit(): process.exit() while fetch's sockets are still
  // closing trips a libuv assertion on Windows, which buries the report above.
  process.exitCode = 1;
} else {
  console.log("\nproduction CSS carries every class globals.css defines.");
}
