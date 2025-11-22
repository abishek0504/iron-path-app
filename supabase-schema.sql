-- ============================================
-- IronPath Database Schema
-- ============================================

-- ============================================
-- 0. ENABLE EXTENSIONS (MUST BE FIRST)
-- ============================================
-- Required for trigram search (gin_trgm_ops)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 1. MASTER EXERCISES TABLE (Global, Read-Only)
-- ============================================
-- This table contains the curated list of 1,000+ exercises that all users see

CREATE TABLE IF NOT EXISTS public.exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    muscle_groups TEXT[] DEFAULT '{}',
    equipment_needed TEXT[] DEFAULT '{}',
    is_timed BOOLEAN DEFAULT false,
    default_duration_sec INTEGER, -- For timed exercises (plank, skipping, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast searching
-- Note: If pg_trgm extension fails, use simple B-tree index instead:
-- CREATE INDEX IF NOT EXISTS idx_exercises_name ON public.exercises(name);
CREATE INDEX IF NOT EXISTS idx_exercises_name ON public.exercises USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_groups ON public.exercises USING gin(muscle_groups);

-- Enable Row Level Security (read-only for all authenticated users)
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read exercises
CREATE POLICY "Anyone can read exercises" ON public.exercises
    FOR SELECT
    USING (true);

-- Policy: Only service role can insert/update/delete (for admin operations)
CREATE POLICY "Service role can manage exercises" ON public.exercises
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- 2. USER CUSTOM EXERCISES TABLE
-- ============================================
-- This table stores user-created custom exercises
-- Single table with user_id index is the fastest and most scalable approach

CREATE TABLE IF NOT EXISTS public.user_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    muscle_groups TEXT[] DEFAULT '{}',
    equipment_needed TEXT[] DEFAULT '{}',
    is_timed BOOLEAN DEFAULT false,
    default_duration_sec INTEGER, -- For timed exercises
    default_sets INTEGER DEFAULT 3,
    default_reps TEXT DEFAULT '8-12',
    default_rest_sec INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name) -- Prevent duplicate names per user
);

-- Indexes for fast searching (user_id index is critical for performance)
CREATE INDEX IF NOT EXISTS idx_user_exercises_user_id ON public.user_exercises(user_id);
-- Note: If pg_trgm extension fails, use simple B-tree index instead:
-- CREATE INDEX IF NOT EXISTS idx_user_exercises_name ON public.user_exercises(name);
CREATE INDEX IF NOT EXISTS idx_user_exercises_name ON public.user_exercises USING gin(name gin_trgm_ops);

-- Enable Row Level Security
ALTER TABLE public.user_exercises ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own custom exercises
CREATE POLICY "Users can view own exercises" ON public.user_exercises
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own custom exercises
CREATE POLICY "Users can create own exercises" ON public.user_exercises
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own custom exercises
CREATE POLICY "Users can update own exercises" ON public.user_exercises
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own custom exercises
CREATE POLICY "Users can delete own exercises" ON public.user_exercises
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 3. POPULATE MASTER EXERCISES TABLE
-- ============================================
-- Insert the initial master exercise list

INSERT INTO public.exercises (name, description, muscle_groups, equipment_needed, is_timed) VALUES
('Bench Press', 'Classic chest exercise performed on a flat bench', ARRAY['Chest', 'Triceps', 'Shoulders'], ARRAY['Barbell', 'Bench'], false),
('Squat', 'Fundamental lower body exercise', ARRAY['Quadriceps', 'Glutes', 'Hamstrings'], ARRAY['Barbell'], false),
('Deadlift', 'Full-body compound movement', ARRAY['Back', 'Hamstrings', 'Glutes'], ARRAY['Barbell'], false),
('Overhead Press', 'Shoulder and tricep exercise', ARRAY['Shoulders', 'Triceps'], ARRAY['Barbell'], false),
('Barbell Row', 'Back and bicep exercise', ARRAY['Back', 'Biceps'], ARRAY['Barbell'], false),
('Pull Up', 'Upper body pulling exercise', ARRAY['Back', 'Biceps'], ARRAY['Pull-up Bar'], false),
('Dumbbell Curl', 'Bicep isolation exercise', ARRAY['Biceps'], ARRAY['Dumbbells'], false),
('Tricep Extension', 'Tricep isolation exercise', ARRAY['Triceps'], ARRAY['Dumbbells', 'Cable'], false),
('Leg Press', 'Quadricep and glute exercise', ARRAY['Quadriceps', 'Glutes'], ARRAY['Leg Press Machine'], false),
('Lunges', 'Unilateral leg exercise', ARRAY['Quadriceps', 'Glutes'], ARRAY['Dumbbells', 'Bodyweight'], false),
('Lat Pulldown', 'Back exercise using cable machine', ARRAY['Back', 'Biceps'], ARRAY['Cable Machine'], false),
('Face Pull', 'Rear deltoid and upper back exercise', ARRAY['Shoulders', 'Back'], ARRAY['Cable Machine'], false),
('Hammer Curl', 'Bicep variation with neutral grip', ARRAY['Biceps', 'Forearms'], ARRAY['Dumbbells'], false),
('Incline Bench Press', 'Chest exercise on inclined bench', ARRAY['Chest', 'Triceps', 'Shoulders'], ARRAY['Barbell', 'Incline Bench'], false),
('Romanian Deadlift', 'Hamstring and glute focused deadlift variation', ARRAY['Hamstrings', 'Glutes', 'Back'], ARRAY['Barbell'], false),
('Plank', 'Core stability exercise', ARRAY['Core'], ARRAY['Bodyweight'], true),
('Skipping', 'Cardiovascular exercise', ARRAY['Cardio', 'Calves'], ARRAY['Jump Rope'], true),
('Push Up', 'Bodyweight chest exercise', ARRAY['Chest', 'Triceps', 'Shoulders'], ARRAY['Bodyweight'], false),
('Dips', 'Tricep and chest exercise', ARRAY['Triceps', 'Chest'], ARRAY['Dip Bars', 'Bodyweight'], false),
('Leg Curl', 'Hamstring isolation exercise', ARRAY['Hamstrings'], ARRAY['Leg Curl Machine'], false)
ON CONFLICT (name) DO NOTHING;


-- ============================================
-- NOTES:
-- ============================================
-- 1. Master exercises table (public.exercises) is read-only for regular users
-- 2. Only service role (admin) can insert/update/delete master exercises
-- 3. Custom exercises are stored in public.user_exercises table with user_id index
-- 4. Single table with indexed user_id is faster than per-user tables
-- 5. Index on user_id enables O(log n) lookups - scales to millions of users
-- 6. When searching, app queries master exercises + user_exercises WHERE user_id = X
-- 7. The pg_trgm extension enables fast text search on exercise names
-- 8. Row Level Security ensures users only see/modify their own exercises

