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
    const { cedula, password } = await req.json();

    console.log('Login attempt for cedula:', cedula);

    // Validate input
    if (!cedula || !password) {
      return new Response(
        JSON.stringify({ error: 'Cédula y contraseña son requeridas' }),
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

    // Get user by cedula using the secure function
    const { data: users, error: getUserError } = await supabaseAdmin
      .rpc('get_user_for_auth', { p_cedula: cedula });

    if (getUserError) {
      console.error('Error getting user:', getUserError);
      return new Response(
        JSON.stringify({ error: 'Error al buscar usuario' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!users || users.length === 0) {
      console.log('User not found for cedula:', cedula);
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado o inactivo' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const user = users[0];

    // Check if user type is allowed to login (only admin and escribano)
    if (user.tipo_usuario === 'operario') {
      return new Response(
        JSON.stringify({ error: 'Acceso solo para administradores y escribanos' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify password
    // Check if password is already hashed (starts with $2a, $2b, or $2y)
    let passwordMatch = false;
    if (user.password_hash.startsWith('$2')) {
      // Password is hashed - compare with bcrypt
      passwordMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      // Legacy plain text password - direct comparison
      passwordMatch = user.password_hash === password;
      
      // If match, hash the password for future logins
      if (passwordMatch) {
        const hashedPassword = await bcrypt.hash(password);
        await supabaseAdmin
          .from('usuarios')
          .update({ password_hash: hashedPassword })
          .eq('id', user.id);
        console.log('Password hashed for user:', user.cedula);
      }
    }

    if (!passwordMatch) {
      console.log('Invalid password for user:', cedula);
      return new Response(
        JSON.stringify({ error: 'Contraseña incorrecta' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Return user data (without password_hash)
    const userSession = {
      id: user.id,
      nombre: user.nombre,
      cedula: user.cedula,
      tipo_usuario: user.tipo_usuario,
      activo: user.activo
    };

    console.log('Login successful for user:', user.nombre);

    return new Response(
      JSON.stringify({ user: userSession }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al iniciar sesión' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});