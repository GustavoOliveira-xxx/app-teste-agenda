// Aviso de versão nova do app Android.
//
// O APK não se atualiza sozinho. Ao abrir, o app consulta a página Releases do
// GitHub (repositório em EXPO_PUBLIC_RELEASES_REPO, preenchido na geração do
// APK) e, se houver uma compilação mais nova, oferece o link para baixar.
// Na versão web não há aviso: o site já se atualiza sozinho.
import { Platform } from 'react-native';

import { env } from '@/config/env';

export interface AvailableUpdate {
  version: string;
  build: number;
  url: string;
}

export interface ReleaseInfo {
  draft: boolean;
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
}

/** Número da compilação no nome da versão publicada (ex.: v1.1.0-build15 → 15). */
export function buildFromTag(tag: string): number | null {
  const m = /build(\d+)/i.exec(tag);
  return m ? Number(m[1]) : null;
}

/** A versão publicada mais recente com APK, se for mais nova que a instalada. */
export function pickUpdate(releases: ReleaseInfo[], currentBuild: number): AvailableUpdate | null {
  for (const release of releases) {
    const build = buildFromTag(release.tag_name);
    const apk = release.assets.find((a) => a.name.toLowerCase().endsWith('.apk'));
    if (release.draft || build === null || !apk) continue;
    if (build <= currentBuild) return null;
    return {
      version: release.tag_name.replace(/^v/i, '').replace(/-build\d+$/i, ''),
      build,
      url: apk.browser_download_url,
    };
  }
  return null;
}

let pending: Promise<AvailableUpdate | null> | null = null;

/** Consulta uma vez por abertura do app; sem internet ou com erro, não avisa nada. */
export function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (Platform.OS !== 'android' || !/^[\w.-]+\/[\w.-]+$/.test(env.releasesRepo)) return Promise.resolve(null);
  pending ??= (async () => {
    try {
      const response = await fetch(`https://api.github.com/repos/${env.releasesRepo}/releases?per_page=10`, {
        headers: { accept: 'application/vnd.github+json' },
      });
      if (!response.ok) return null;
      return pickUpdate((await response.json()) as ReleaseInfo[], env.appBuild);
    } catch {
      return null;
    }
  })();
  return pending;
}
