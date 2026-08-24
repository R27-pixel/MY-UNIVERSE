// @ts-nocheck
// ^ This suppresses fake VSCode errors. Supabase Edge Functions use Deno,
// which causes red lines in editors configured for React/Node.js.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

/**
 * verify-invitation — Server-side authentication Edge Function.
 *
 * SECURITY CONTRACT:
 *   - Secrets are read ONLY from Deno server-side environment variables.
 *   - There are NO hardcoded fallback passwords in this file.
 *     If env vars are missing the function returns 503 (configuration error), not 401.
 *     This prevents a misconfigured deploy from accidentally accepting any passcode.
 *   - The caller supplies only { profile, passcode } — no trust is placed in any
 *     identity claims from the request body.
 *   - CORS is restricted to the app's own origin in production via ALLOWED_ORIGIN env var.
 */

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '';

function getCorsHeaders(reqOrigin: string | null): Record<string, string> {
  // In production, restrict to the configured origin.
  // During local development (no ALLOWED_ORIGIN set), allow any origin.
  const origin = ALLOWED_ORIGIN ? ALLOWED_ORIGIN : (reqOrigin || '*');
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const reqOrigin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(reqOrigin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body safely
    let profile: string | undefined;
    let passcode: string | undefined;
    try {
      const body = await req.json();
      profile = body?.profile;
      passcode = body?.passcode;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile || !passcode || typeof passcode !== 'string' || typeof profile !== 'string') {
      return new Response(
        JSON.stringify({ error: 'INVALID_REQUEST' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalise profile to prevent injection
    const normalizedProfile = profile.toLowerCase().trim();
    if (normalizedProfile !== 'r27' && normalizedProfile !== 'spam') {
      return new Response(
        JSON.stringify({ error: 'INVALID_PROFILE' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read server-side environment secrets — NO hardcoded fallbacks.
    // If environment variables are not configured, return 503 (configuration error).
    // This ensures a misconfigured deploy cannot accidentally authenticate anyone.
    const secretR27 = Deno.env.get('INVITATION_SECRET_R27');
    const secretSpam = Deno.env.get('INVITATION_SECRET_SPAM');

    if (!secretR27 || !secretSpam) {
      console.error('[verify-invitation] FATAL: INVITATION_SECRET_R27 or INVITATION_SECRET_SPAM env vars not set.');
      return new Response(
        JSON.stringify({ error: 'Service configuration error. Contact administrator.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expectedSecret = normalizedProfile === 'r27' ? secretR27 : secretSpam;
    const trimmedInput = passcode.trim();

    // Constant-time string comparison to mitigate timing attacks
    if (!constantTimeEqual(trimmedInput, expectedSecret)) {
      // Add a small artificial delay to make brute-force slower (200-400ms jitter)
      await randomDelay(200, 400);
      return new Response(
        JSON.stringify({ error: 'INVALID_INVITATION_CODE' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Passcode verified — create or retrieve Supabase Auth user and issue a session
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('[verify-invitation] FATAL: Missing Supabase environment configuration.');
      return new Response(
        JSON.stringify({ error: 'Service configuration error. Contact administrator.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const email = `${normalizedProfile}@ouruniverse.internal`;
    // Password is derived server-side only — never sent to or from the browser
    const password = `Universe_${normalizedProfile}_${expectedSecret}_Key`;

    // Look up the fixed account first. This avoids relying on provider-specific
    // duplicate-user error text and lets a verified invitation repair old passwords.
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });
    const existingUser = userList?.users.find((user) => user.email === email);

    if (listError) {
      console.error('[verify-invitation] User lookup failed:', listError.message);
      return new Response(
        JSON.stringify({ error: 'AUTH_USER_LOOKUP_FAILED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingUser) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { profile: normalizedProfile },
      });

      if (updateError) {
        console.error('[verify-invitation] Existing user update failed:', updateError.message);
        return new Response(
          JSON.stringify({ error: 'AUTH_USER_UPDATE_FAILED' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { profile: normalizedProfile },
      });

      if (createError) {
        console.error('[verify-invitation] Error creating user:', createError.message);
        return new Response(
          JSON.stringify({ error: 'AUTH_USER_CREATE_FAILED' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Sign in via anon client to generate a JWT session for the browser
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData?.session) {
      console.error('[verify-invitation] Sign-in error:', signInError?.message);
      return new Response(
        JSON.stringify({ error: 'AUTH_SIGNIN_FAILED', detail: signInError?.message || 'No session returned' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_profile: normalizedProfile,
        session: signInData.session,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[verify-invitation] Unexpected error:', err?.message || err);
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Constant-time string comparison to mitigate timing side-channel attacks.
 * Avoids early exit on first mismatch.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Introduces a random delay between minMs and maxMs to slow brute-force attempts.
 */
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return new Promise((resolve) => setTimeout(resolve, ms));
}
