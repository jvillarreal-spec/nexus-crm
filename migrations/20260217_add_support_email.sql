-- Add support_email column to companies table
ALTER TABLE IF EXISTS public.companies 
ADD COLUMN IF NOT EXISTS support_email TEXT;

-- Update the existing company with a default if needed
UPDATE public.companies SET support_email = 'soporte@nexuscrm.ai' WHERE support_email IS NULL;
