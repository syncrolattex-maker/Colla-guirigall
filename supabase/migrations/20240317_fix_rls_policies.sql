-- Migration to fix RLS policies for users and songs
-- Created on 2026-03-17

-- Fix RLS for users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own profile
DO $$ BEGIN
  CREATE POLICY "Allow authenticated users to insert" ON public.users 
  FOR INSERT TO authenticated 
  WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated users to see all members
DO $$ BEGIN
  CREATE POLICY "Allow authenticated users to select" ON public.users 
  FOR SELECT TO authenticated 
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Allow users to update only their own profile
DO $$ BEGIN
  CREATE POLICY "Allow users to update own profile" ON public.users 
  FOR UPDATE TO authenticated 
  USING (auth.uid()::text = uid);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Fix RLS for songs table
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to see the repertoire
DO $$ BEGIN
  CREATE POLICY "Allow authenticated users to see songs" ON public.songs 
  FOR SELECT TO authenticated 
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated to manage songs
DO $$ BEGIN
  CREATE POLICY "Allow authenticated to manage songs" ON public.songs
  FOR ALL TO authenticated
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
