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
    const { nombre, cedula, password, tipo_usuario } = await req.json();

    console.log('Signup attempt for cedula:', cedula);

    // Validate input
    if (!nombre || !cedula || !password) {
      return new Response(
        JSON.stringify({ error: 'Nombre, cédula y contraseña son requeridos' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate nombre length
    if (nombre.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'El nombre debe tener al menos 2 caracteres' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate cedula format (basic validation)
    if (cedula.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: 'La cédula debe tener al menos 5 caracteres' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate password length
    if (password.length < 4) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 4 caracteres' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client with service role key for bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('cedula', cedula.trim())
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Ya existe un usuario con esta cédula' }),
        { 
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password);
    console.log('Password hashed successfully');

    // Create new user
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        nombre: nombre.trim(),
        cedula: cedula.trim(),
        password_hash: hashedPassword,
        tipo_usuario: tipo_usuario || 'operario',
        activo: true
      })
      .select('id, nombre, cedula, tipo_usuario, activo')
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError);
      return new Response(
        JSON.stringify({ error: 'Error al crear usuario' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('User created successfully:', newUser.nombre);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Usuario creado correctamente'
      }),
      { 
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Signup error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al registrar usuario' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});