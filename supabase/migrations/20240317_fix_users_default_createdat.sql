-- Migration to fix users table createdAt default
-- Created on 2026-03-17

ALTER TABLE public.users 
ALTER COLUMN "createdAt" SET DEFAULT NOW();
