
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE PARA ACTIVAR RECARGA EN VIVO

-- 1. Habilitar Realtime para la tabla de contactos (esto permite que el Coach se vea en vivo)
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;

-- 2. (Opcional pero recomendado) Verificar que los mensajes también tengan realtime por si acaso
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; -- Ya debería estar, pero no sobra.
