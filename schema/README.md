# Database Schema Migrations

## Setup Instructions

Run the SQL migrations in order to create the required database tables.

### Migration Order

1. Run `workout_sessions.sql` to create the workout_sessions table and update workout_logs

### Running Migrations

You can run these migrations in your Supabase SQL Editor or via the Supabase CLI:

```bash
# Using Supabase CLI
supabase db reset

# Or run the SQL file directly in Supabase Dashboard > SQL Editor
```

### Table: workout_sessions

Tracks active workout sessions with minimal state. This table:
- Stores only current position (exercise_index, set_index) - NOT full progress
- Links users to their workout plans
- Tracks session status (active, completed, abandoned)
- Includes timestamps for session lifecycle

**Design Philosophy:**
- **Minimal state storage**: Only stores current position, not completed sets
- **Single source of truth**: `workout_logs` is the source of truth for completed sets
- **Efficient**: No data duplication - progress is reconstructed from logs when needed
- **Fast**: AsyncStorage used for in-memory state during active workouts

**Required for:**
- Resuming incomplete workouts (knows where user left off)
- Showing "Continue Workout" button on home screen
- Tracking active session metadata

### workout_logs Updates

The migration also adds `plan_id`, `day`, and `session_id` to `workout_logs`:
- Enables efficient querying of logs by plan/day
- Links logs to their workout session
- Allows reconstruction of workout progress from logs

