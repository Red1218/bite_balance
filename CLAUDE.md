# Bite Balance

## Database changes

- Every new migration in `supabase/migrations/` goes in the same commit as a regenerated `src/integrations/supabase/types.ts` (generate it from the live project after applying the migration), so the types never fall behind the schema.

## Checks

- `npm run typecheck` and `npm run lint` must pass with 0 errors; CI (`.github/workflows/ci.yml`) runs both on every push and pull request. Lint warnings are allowed.
