# Type Generation

TypeScript types for Supabase must be generated from the database schema to prevent drift.

## Generate Types

```bash
npx supabase gen types typescript --project-id your_project_id > src/types/supabase.ts
```

Or if using Supabase CLI locally:

```bash
supabase gen types typescript --local > src/types/supabase.ts
```

## When to Regenerate

- After applying any database migration
- After schema changes
- Before committing changes that affect the database

## Drift Prevention

The types in this directory should always match the database schema. If types are out of sync, the app may have runtime errors or type mismatches.

Consider adding a CI check to verify types match the schema.

