-- NEXUS MULTI-TENANT MIGRATION
-- NOTE: Run these blocks separately if you see "enum type" errors.

-- ==========================================
-- STEP 1: ENUMS & STRUCTURE (Run this first)
-- ==========================================

-- A. Create Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- B. Update User Roles & Profiles Column
DO $$
BEGIN
    -- Ensure user_role type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('super_admin', 'org_admin', 'agent');
    ELSE
        -- Ensure all values exist
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'super_admin') THEN
            ALTER TYPE user_role ADD VALUE 'super_admin';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'org_admin') THEN
            ALTER TYPE user_role ADD VALUE 'org_admin';
        END IF;
    END IF;

    -- Ensure 'role' column exists in profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role user_role DEFAULT 'agent';
    END IF;
END $$;

-- C. Add company_id and foreign keys
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- D. Initial Data Migration (Assign everyone to a default company)
DO $$
DECLARE
    default_company_id UUID;
BEGIN
    INSERT INTO public.companies (name, slug) 
    VALUES ('Nexus Global', 'nexus-global') 
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO default_company_id;

    UPDATE public.profiles SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.contacts SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.conversations SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.messages SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.deals SET company_id = default_company_id WHERE company_id IS NULL;
END $$;


-- ==========================================
-- STEP 2: POLICIES & LOGIC (Run after Step 1)
-- ==========================================

-- A. Clean up old policies (and new ones if rerunning)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Contacts viewable by agents" ON public.contacts;
DROP POLICY IF EXISTS "Conversations viewable by agents" ON public.conversations;
DROP POLICY IF EXISTS "Messages viewable by agents" ON public.messages;
DROP POLICY IF EXISTS "Deals viewable by agents" ON public.deals;

-- Clean up the newly defined multi-tenant policies to ensure idempotency
DROP POLICY IF EXISTS "Super Admins view all companies" ON public.companies;
DROP POLICY IF EXISTS "Org Admins view own company" ON public.companies;
DROP POLICY IF EXISTS "Common access within company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Company wide contacts access" ON public.contacts;
DROP POLICY IF EXISTS "Company wide conversations access" ON public.conversations;
DROP POLICY IF EXISTS "Company wide messages access" ON public.messages;
DROP POLICY IF EXISTS "Company wide deals access" ON public.deals;

-- B. New Multi-tenant Policies
CREATE POLICY "Super Admins view all companies" ON public.companies FOR ALL 
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid())::text = 'super_admin');

CREATE POLICY "Org Admins view own company" ON public.companies FOR SELECT 
    USING (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Common access within company profiles" ON public.profiles FOR SELECT
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Company wide contacts access" ON public.contacts FOR ALL
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Company wide conversations access" ON public.conversations FOR ALL
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (
            (SELECT role FROM public.profiles WHERE id = auth.uid())::text IN ('org_admin', 'super_admin')
            OR assigned_to = auth.uid()
        )
    );

CREATE POLICY "Company wide messages access" ON public.messages FOR ALL
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Company wide deals access" ON public.deals FOR ALL
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- C. Update handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, company_id)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'agent'),
    (new.raw_user_meta_data->>'company_id')::UUID
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
