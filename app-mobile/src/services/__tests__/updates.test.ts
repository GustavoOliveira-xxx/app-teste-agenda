import { buildFromTag, pickUpdate, type ReleaseInfo } from '../updates';

const release = (tag: string, apk = true, draft = false): ReleaseInfo => ({
  tag_name: tag,
  draft,
  assets: apk
    ? [
        { name: `agenda-${tag}.aab`, browser_download_url: `https://x/${tag}.aab` },
        { name: `agenda-${tag}.apk`, browser_download_url: `https://x/${tag}.apk` },
      ]
    : [],
});

describe('aviso de versão nova', () => {
  test('lê o número da compilação do nome da versão', () => {
    expect(buildFromTag('v1.1.0-build15')).toBe(15);
    expect(buildFromTag('v2.0.0')).toBeNull();
  });

  test('avisa quando a versão publicada mais recente é mais nova', () => {
    expect(pickUpdate([release('v1.2.0-build20'), release('v1.1.0-build15')], 15)).toEqual({
      version: '1.2.0',
      build: 20,
      url: 'https://x/v1.2.0-build20.apk',
    });
  });

  test('não avisa quando a instalada já é a mais nova', () => {
    expect(pickUpdate([release('v1.1.0-build15')], 15)).toBeNull();
    expect(pickUpdate([release('v1.1.0-build15')], 16)).toBeNull();
  });

  test('ignora rascunhos e versões sem APK', () => {
    const lista = [
      release('v1.3.0-build30', true, true),
      release('v1.2.5-build25', false),
      release('v1.2.0-build20'),
    ];
    expect(pickUpdate(lista, 15)?.build).toBe(20);
    expect(pickUpdate([], 15)).toBeNull();
  });
});
