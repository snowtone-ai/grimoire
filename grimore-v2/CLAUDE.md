# grimore-v2/CLAUDE.md -- long-lived integration branch conventions

main auto-deploys to the production origin the family uses daily; grimore-v2 is a long,
high-churn, speculative design+dev effort with no ship date. All grimore-v2 work --
design-consult docs (grimore-v2/*.md) and future implementation -- branches from and
targets the long-lived `grimore-v2` branch instead of main; it is v2's de facto main
until the owner explicitly decides to ship, at which point grimore-v2 merges into main
as one deliberate release. tasks.md/docs/decisions.md/docs/state.md are edited
independently on each branch for the duration (accepted tradeoff: expect a ledger merge
conflict at ship time, resolved by keeping both branches' new rows).
