import { Redirect } from 'expo-router';

import { useUiStore } from '@/stores/uiStore';

/** Primeira abertura: mostra a apresentação; depois, a tela de boas-vindas. */
export default function AuthIndex() {
  const onboardingDone = useUiStore((s) => s.onboardingDone);
  return <Redirect href={onboardingDone ? '/welcome' : '/onboarding'} />;
}
