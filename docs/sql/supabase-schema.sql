-- Supabase Schema for Cutoff Extension (Auth-Enabled)

-- 1. Profiles (Linked to Supabase Auth)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    pairing_code TEXT UNIQUE, -- Used for linking extension to dashboard
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. System Current State (Real-time Mirror)
CREATE TABLE public.system_current (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    system_state TEXT NOT NULL DEFAULT 'void', -- void, stable, turbulent, critical, focused, deferred
    total_captures INTEGER DEFAULT 0,
    open_loops INTEGER DEFAULT 0,
    shadowed_count INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id)
);

-- 3. System Snapshots (For Dynamics View / History)
CREATE TABLE public.system_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    system_state TEXT NOT NULL,
    total_captures INTEGER NOT NULL,
    open_loops INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Policies (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_snapshots ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- System Current: Users can only see/update their own state
CREATE POLICY "Users can view own system state" ON public.system_current FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can update own system state" ON public.system_current FOR ALL USING (auth.uid() = profile_id);

-- System Snapshots: Users can only see their own snapshots
CREATE POLICY "Users can view own snapshots" ON public.system_snapshots FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Extension can insert snapshots" ON public.system_snapshots FOR INSERT WITH CHECK (auth.uid() = profile_id);
-- Secure Pairing Function
CREATE OR REPLACE FUNCTION verify_pairing_code(input_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id
  FROM public.profiles
  WHERE pairing_code = input_code
  LIMIT 1;

  RETURN found_id;
END;
$$;
