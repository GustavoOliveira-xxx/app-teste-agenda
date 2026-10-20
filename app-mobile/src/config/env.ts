// Configuração lida das variáveis de ambiente no momento do build.
// Valores vêm de app-mobile/.env (local) ou das "Variables" do GitHub Actions.
import Constants from 'expo-constants';

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appVersion: Constants.expoConfig?.version ?? '1.0.0',
  isDev: __DEV__,
};

/** O app sabe onde fica o servidor? Sem isso, mostra a tela "Servidor não configurado". */
export const isSupabaseConfigured =
  /^https:\/\/[^\s]+$/.test(env.supabaseUrl) &&
  !env.supabaseUrl.includes('SEU-PROJETO') &&
  env.supabaseAnonKey.length > 20 &&
  !env.supabaseAnonKey.includes('xxxx');
