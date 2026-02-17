
-- FIX FOR RLS RECURSION
-- Create helper functions to retrieve role and company_id without triggering RLS

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Update Policies to use these functions
DROP POLICY IF EXISTS "Super Admins view all companies" ON public.companies;
CREATE POLICY "Super Admins view all companies" ON public.companies FOR ALL 
    USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Org Admins view own company" ON public.companies;
CREATE POLICY "Org Admins view own company" ON public.companies FOR SELECT 
    USING (id = public.get_my_company_id());

DROP POLICY IF EXISTS "Common access within company profiles" ON public.profiles;
CREATE POLICY "Common access within company profiles" ON public.profiles FOR SELECT
    USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Company wide contacts access" ON public.contacts;
CREATE POLICY "Company wide contacts access" ON public.contacts FOR ALL
    USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Company wide conversations access" ON public.conversations;
CREATE POLICY "Company wide conversations access" ON public.conversations FOR ALL
    USING (
        company_id = public.get_my_company_id()
        AND (
            public.get_my_role() IN ('org_admin', 'super_admin')
            OR assigned_to = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Company wide messages access" ON public.messages;
CREATE POLICY "Company wide messages access" ON public.messages FOR ALL
    USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Company wide deals access" ON public.deals;
CREATE POLICY "Company wide deals access" ON public.deals FOR ALL
    USING (company_id = public.get_my_company_id());
