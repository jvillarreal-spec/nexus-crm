
-- EJECUTAR ESTO EN EL SQL EDITOR DE SUPABASE

-- 1. Crear tabla de conocimiento
CREATE TABLE IF NOT EXISTS public.organization_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS (Seguridad)
ALTER TABLE public.organization_knowledge ENABLE ROW LEVEL SECURITY;

-- 3. Crear política para que agentes autenticados puedan leer y escribir
DROP POLICY IF EXISTS "Knowledge viewable by agents" ON public.organization_knowledge;
CREATE POLICY "Knowledge viewable by agents" 
ON public.organization_knowledge 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 4. Insertar datos iniciales si está vacío
INSERT INTO public.organization_knowledge (content) 
SELECT 'Bienvenido a NexusCRM. Configura aquí tu contexto de negocio.' 
WHERE NOT EXISTS (SELECT 1 FROM public.organization_knowledge);
