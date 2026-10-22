// Estado de autenticação: sessão do Supabase e dados da conta.
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { Account } from '@/models/types';

interface AuthState {
  initialized: boolean;
  session: Session | null;
  account: Account | null;
  /** E-mail aguardando o código de confirmação do cadastro. */
  pendingEmail: string | null;
  /** Mensagem para a tela de login (ex.: a entrada com Google falhou). */
  notice: string | null;
  setNotice: (notice: string | null) => void;
  setSession: (session: Session | null) => void;
  setAccount: (account: Account | null) => void;
  setPendingEmail: (email: string | null) => void;
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  initialized: false,
  session: null,
  account: null,
  pendingEmail: null,
  notice: null,
  setNotice: (notice) => set({ notice }),
  setSession: (session) => set({ session }),
  setAccount: (account) => set({ account }),
  setPendingEmail: (pendingEmail) => set({ pendingEmail }),
  setInitialized: () => set({ initialized: true }),
}));

export const useUserId = () => useAuthStore((s) => s.session?.user.id ?? null);
