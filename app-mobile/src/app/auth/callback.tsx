// Volta do Google no Android (agendacompartilhada://auth/callback?code=...).
// Normalmente o código já foi trocado pela sessão na tela de login; esta rota
// cobre o caso em que o app foi reaberto pelo link.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { LoadingState } from '@/components/StateViews';
import { supabase } from '@/services/supabase';

export default function OAuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [done, setDone] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session && typeof code === 'string' && code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
      }
      setDone(true);
    })();
  }, [code]);
  return done ? <Redirect href="/" /> : <LoadingState />;
}
