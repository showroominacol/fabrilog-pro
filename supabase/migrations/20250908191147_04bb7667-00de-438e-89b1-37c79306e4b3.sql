-- Fix security warning: Set search_path for existing functions
-- Update the existing functions to have proper search_path set

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    NEW.fecha_actualizacion = now();
    RETURN NEW;
END;
$function$;

-- Fix get_current_user_profile function  
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS usuarios
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT * FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
$function$;