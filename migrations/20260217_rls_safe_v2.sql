
-- SAFE RLS FIX - V2
-- This version prioritizes direct checks and minimizes subqueries in profiles

-- 1. Helper Function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Profiles Table - SEPARATE POLICIES (VERY IMPORTANT)
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_company_select" ON public.profiles;
DROP POLICY IF EXISTS "Common access within company profiles" ON public.profiles;

-- Anyone can see their own profile (No recursion)
CREATE POLICY "profiles_self_select" ON public.profiles 
FOR SELECT USING (id = auth.uid());

-- Admin/SuperAdmin can see others in same company
CREATE POLICY "profiles_company_select" ON public.profiles 
FOR SELECT USING (
    company_id = public.get_my_company_id() 
    AND public.get_my_role() IN ('org_admin', 'super_admin')
);

-- 3. Update Other Tables to use the safe function
-- (Policies for contacts, conversations, etc. remain the same as they use the function which is SECURITY DEFINER)
