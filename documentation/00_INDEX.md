# IronPath V2 Documentation

**Generated**: 2026-01-19  
**Last Updated**: 2026-01-21 (Active Workout Flow & Set Completion Tracking)  
**Philosophy**: Document what matters - architecture decisions, data flows, and setup procedures. Let well-written code document itself.

## Core Documentation

1. **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Core principles, data layering, architectural decisions (WHY)
2. **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete schema, migrations, RLS policies (WHAT tables, relationships)
3. **[ALGORITHMS.md](ALGORITHMS.md)** - Mathematical formulas and algorithms with worked examples (HOW calculations work)
4. **[DATA_FLOWS.md](DATA_FLOWS.md)** - How components/queries/stores connect, user flows (HOW things connect)
5. **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Environment setup, running the app, type generation (HOW to get started)
6. **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** - What's complete, what's TODO, known issues (WHAT state we're in)

## Quick Reference

### For New Developers
1. Read `SYSTEM_ARCHITECTURE.md` - understand core principles
2. Read `DATABASE_SCHEMA.md` - understand data model
3. Follow `SETUP_GUIDE.md` - get running
4. Review `DATA_FLOWS.md` - understand how components connect

### For Adding Features
1. Check `IMPLEMENTATION_STATUS.md` - see what exists
2. Review `DATA_FLOWS.md` - understand existing patterns
3. Check `ALGORITHMS.md` - if adding calculations/formulas
4. Update `IMPLEMENTATION_STATUS.md` when done

### For Database Work
- `DATABASE_SCHEMA.md` - migration order, RLS policies, relationships
- Migrations in `supabase/migrations/` - actual SQL
- Query functions in `src/lib/supabase/queries/` - usage patterns

### For Understanding Algorithms
- `ALGORITHMS.md` - formulas with examples
- Engine files in `src/lib/engine/` - actual implementation
- Query functions provide data inputs

## What This Documentation Covers

✅ **Architecture**: Core principles, data layering, state management patterns, navigation system  
✅ **Database**: Schema, migrations, RLS, relationships, seed data  
✅ **Algorithms**: Mathematical formulas, worked examples, edge cases  
✅ **Data Flows**: How queries/stores/components connect, critical user flows  
✅ **Setup**: Environment, dependencies, running the app  
✅ **Status**: What's implemented, what's TODO, known issues  

## What This Documentation Doesn't Cover

❌ **Function Signatures** - TypeScript types document these  
❌ **Variable Names** - Already descriptive (e.g., `exerciseId`, `sets_min`)  
❌ **Component Props** - TypeScript interfaces document these  
❌ **Constants** - Already named descriptively (e.g., `MAX_SETS`, `STIMULUS_DEFAULT`)  

## The Code is Self-Documenting

This project uses:
- TypeScript for type safety
- Descriptive naming conventions (`camelCase` for JS, `snake_case` for DB)
- Inline comments for complex logic
- `devLog()` for operational insights

**Example**: Instead of documenting every function, we document the pattern:
```typescript
// Pattern documented in DATA_FLOWS.md:
// Query functions always: 1) log action, 2) try/catch, 3) return null/[] on error

// Actual code is self-documenting:
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  devLog('user-query', { action: 'getUserProfile', userId });
  // implementation...
}
```

## Archive

Old documentation archived in [`archive/`](archive/) with timestamps.

## Recent Updates

### 2026-01-21: Active Workout Flow & Set Completion
- **CRITICAL BUG FIX**: `markSetComplete` now always sets `performed_at` timestamp
- **Exercise-by-Exercise Flow**: Implemented workout phase state machine (execution → rest → logging)
- **Batch Logging**: User logs all sets after completing all reps for an exercise
- **Resume Logic**: "Continue" button appears correctly after mid-workout exit
- **Weight Suggestions**: Added `suggested_weight_lbs/kg` to prescriptions, seeded 45 exercises
- **UX Improvements**: Keyboard dismiss, exercise info, improved bottom sheet UI

**Documentation Updated**:
- `DATABASE_SCHEMA.md`: Added performed_at semantics and bug fix note
- `DATA_FLOWS.md`: Complete workout flow with phase transitions
- `SYSTEM_ARCHITECTURE.md`: Added workout state machine section
- `IMPLEMENTATION_STATUS.md`: Updated feature matrix and known issues
- `progress_log.txt`: Detailed debugging and fix history

## Maintenance

When updating:
- **Code changes**: Usually no doc update needed (code documents itself)
- **New algorithm**: Add to `ALGORITHMS.md` with formula + example
- **Schema change**: Update `DATABASE_SCHEMA.md` and migration file
- **Architecture decision**: Update `SYSTEM_ARCHITECTURE.md` with WHY
- **New feature**: Update `IMPLEMENTATION_STATUS.md`
- **Bug fix**: Add note to `progress_log.txt` and affected docs

This keeps documentation maintainable while remaining comprehensive.
