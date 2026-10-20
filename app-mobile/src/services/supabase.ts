// Cliente do Supabase (autenticação + banco + tempo real).
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isSupabaseConfigured } from '@/config/env';
import { secureSessionStorage } from '@/offline/secureStorage';

export const supabase = createClient(
  isSupabaseConfigured ? env.supabaseUrl : 'https://nao-configurado.invalid',
  isSupabaseConfigured ? env.supabaseAnonKey : 'nao-configurado',
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: { headers: { 'x-client-info': `agenda-compartilhada/${env.appVersion} (${Platform.OS})` } },
  },
);

// Recomendação do Supabase para apps: só renovar o token com o app aberto.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Lança o erro do Supabase (se houver) e devolve os dados. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}
