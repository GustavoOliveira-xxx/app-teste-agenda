import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { env, isSupabaseConfigured } from '@/config/env';
import { getDeviceTimezone } from '@/hooks/useDeviceTimezone';
import { t } from '@/i18n';
import { clearErrorLog, getErrorLog, type ErrorEntry } from '@/services/errorLog';
import { getPermissionStatus } from '@/services/localNotifications';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';

/** Informações técnicas para quem desenvolve ou presta suporte. Sem senhas nem tokens. */
export default function DiagnosticsScreen() {
  const { toast } = useFeedback();
  const sync = useSyncStore();
  const data = useDataStore();
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [permission, setPermission] = useState('');

  useEffect(() => {
    void getErrorLog().then(setErrors);
    void getPermissionStatus().then(setPermission);
  }, []);

  const info = {
    app: `${env.appVersion} (build ${env.appBuild})`,
    plataforma: `${Platform.OS} ${Device.osVersion ?? ''}`.trim(),
    aparelho: Device.modelName ?? '-',
    servidorConfigurado: isSupabaseConfigured,
    servidor: env.supabaseUrl.replace(/^https:\/\/([^.]{4})[^.]*/, 'https://$1***'),
    fuso: getDeviceTimezone(),
    online: sync.online,
    ultimaSincronizacao: sync.lastSyncAt,
    filaPendente: sync.outbox.length,
    metricas: sync.metrics,
    agendas: data.calendars.length,
    eventosNoAparelho: Object.keys(data.events).length,
    janela: data.window,
    permissaoNotificacoes: permission,
  };
  const text = JSON.stringify({ ...info, erros: errors.slice(0, 20) }, null, 2);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('diagnostics.title') }} />
      <AppText tone="muted">{t('diagnostics.note')}</AppText>
      <Card>
        <AppText
          selectable
          style={{ fontFamily: Platform.select({ android: 'monospace', default: 'Courier' }), fontSize: 12 }}
        >
          {JSON.stringify(info, null, 2)}
        </AppText>
      </Card>
      <SectionHeader title={t('diagnostics.recentErrors', { n: errors.length })} />
      {errors.slice(0, 20).map((e) => (
        <AppText key={`${e.at}-${e.message}`} variant="small" tone="muted" selectable>
          {e.at} [{e.where}] {e.message}
        </AppText>
      ))}
      <Button
        title={t('common.copy')}
        icon="copy-outline"
        variant="secondary"
        onPress={async () => {
          await Clipboard.setStringAsync(text);
          toast(t('common.copied'));
        }}
      />
      <Button
        title={t('common.clear')}
        variant="ghost"
        onPress={async () => {
          await clearErrorLog();
          setErrors([]);
        }}
      />
    </Screen>
  );
}
