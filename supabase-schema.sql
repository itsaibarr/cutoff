-- Supabase Schema for Cutoff Extension

-- 1. Profiles (Linked to Extension Session)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT UNIQUE NOT NULL, -- The unique ID from the extension
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. System Current State (Real-time Mirror)
CREATE TABLE public.system_current (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    system_state TEXT NOT NULL, -- void, stable, turbulent, critical, focused, deferred
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

-- Allow read-only access to snapshots for the owner
CREATE POLICY "Allow public read-only access to current state" 
ON public.system_current FOR SELECT USING (true);

CREATE POLICY "Allow extension to update its own state" 
ON public.system_current FOR ALL USING (true) WITH CHECK (true);
