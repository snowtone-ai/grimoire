---
paths:
  - "src/lib/**/*.ts"
  - "tests/**/*.test.mjs"
---

# node:test + relative imports

`pnpm test` runs `node --test tests/**/*.test.mjs` directly against `.ts` source files
(Node's native type-stripping, no ts-node/tsx loader). Extension-less relative imports
in `src/lib/*.ts` (`from "./db"`) resolve fine under Next.js/webpack but throw
`ERR_MODULE_NOT_FOUND` under Node's raw ESM resolver — the build and typecheck both
pass regardless, since neither uses that resolver. The gap stays invisible until a file
is imported (even transitively) by a `tests/**/*.test.mjs` file for the first time.

`src/lib/db.ts` and `src/lib/rewardDb.ts` already use explicit `.ts` extensions;
`src/lib/taskDb.ts` was fixed when this was first hit (T029/D-034). `src/lib/backup.ts`,
`src/lib/gemini.ts`, and `src/lib/notifications.ts` still have the same latent gap as of
this writing — untested by any `node:test` file so far.

Before writing a `node:test`/`fake-indexeddb` test that imports a `src/lib/*.ts` module
for the first time, check that module's own relative imports for a missing `.ts`
extension and fix them as part of the same change — this is a precondition for the test
to run at all, not scope creep.
