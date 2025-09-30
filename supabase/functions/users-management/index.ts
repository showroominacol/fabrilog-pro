import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userId, userData } = await req.json();

    console.log('User management action:', action);

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different actions
    switch (action) {
      case 'create': {
        const { nombre, cedula, password, tipo_usuario } = userData;

        // Validate input
        if (!nombre || !cedula || !password) {
          return new Response(
            JSON.stringify({ error: 'Todos los campos son requeridos' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user exists
        const { data: existing } = await supabaseAdmin
          .from('usuarios')
          .select('id')
          .eq('cedula', cedula)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({ error: 'Ya existe un usuario con esta cédula' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password);

        // Create user
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('usuarios')
          .insert({
            nombre: nombre.trim(),
            cedula: cedula.trim(),
            password_hash: hashedPassword,
            tipo_usuario: tipo_usuario || 'operario',
            activo: true
          })
          .select('id, nombre, cedula, tipo_usuario, activo, fecha_creacion')
          .single();

        if (createError) {
          console.error('Create error:', createError);
          return new Response(
            JSON.stringify({ error: 'Error al crear usuario' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ user: newUser }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'ID de usuario requerido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: any = {};
        
        if (userData.nombre) updateData.nombre = userData.nombre.trim();
        if (userData.cedula) updateData.cedula = userData.cedula.trim();
        if (userData.tipo_usuario) updateData.tipo_usuario = userData.tipo_usuario;
        if (userData.activo !== undefined) updateData.activo = userData.activo;
        
        // Hash password if provided
        if (userData.password) {
          updateData.password_hash = await bcrypt.hash(userData.password);
        }

        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('usuarios')
          .update(updateData)
          .eq('id', userId)
          .select('id, nombre, cedula, tipo_usuario, activo, fecha_creacion')
          .single();

        if (updateError) {
          console.error('Update error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Error al actualizar usuario' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ user: updatedUser }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'ID de usuario requerido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Soft delete - just mark as inactive
        const { error: deleteError } = await supabaseAdmin
          .from('usuarios')
          .update({ activo: false })
          .eq('id', userId);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Error al eliminar usuario' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Acción no válida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('User management error:', error);
    return new Response(
      JSON.stringify({ error: 'Error en la operación' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});