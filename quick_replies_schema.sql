-- NEXUS CRM: Quick Replies Table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    shortcut TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- Policies (Public for now, following project pattern)
CREATE POLICY "Enable read access for all users" ON public.quick_replies FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.quick_replies FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.quick_replies FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.quick_replies FOR DELETE USING (true);

-- Insert some default examples
INSERT INTO public.quick_replies (title, shortcut, content)
VALUES 
('Saludo Inicial', '/hola', 'Hola, ¡un gusto saludarte! Soy Julian de NexusCRM. ¿En qué puedo ayudarte hoy?'),
('Precios', '/precios', 'Contamos con 3 planes: Individual ($29/mes), Pro ($79/mes) y Enterprise (Consultar). Todos incluyen IA básica.'),
('Agendar Demo', '/demo', '¡Claro! Puedes agendar una demostración personalizada en este enlace: https://calendly.com/nexuscrm-demo');
