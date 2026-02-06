-- FIX: Ensure all required RLS policies are in place
-- Run this in your Supabase SQL Editor.

-- Profiles: Enable INSERT, SELECT, and UPDATE for the owner
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- System Current: Ensure full access for the owner (Required for upsert)
DROP POLICY IF EXISTS "Users can update own system state" ON public.system_current;
CREATE POLICY "Users can update own system state" ON public.system_current FOR ALL USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can view own system state" ON public.system_current;
CREATE POLICY "Users can view own system state" ON public.system_current FOR SELECT USING (auth.uid() = profile_id);
