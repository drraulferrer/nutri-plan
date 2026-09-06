-- La función la crea la opción "Enable automatic RLS" del panel al crear el proyecto;
-- no debe ser invocable desde la API pública (aviso del advisor de seguridad).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
