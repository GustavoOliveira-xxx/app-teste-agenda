// Contraste das cores SynCK (norma WCAG AA): 4,5:1 para texto e 3:1 para
// bordas e elementos gráficos. Se alguma cor da marca mudar, estes testes
// dizem qual par ficou fraco.
import { CORES_DE_AGENDA, marca, type CoresDoTema } from '../marca';

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`cor inválida: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  ['claro', marca.cores.claro],
  ['escuro', marca.cores.escuro],
] as [string, CoresDoTema][])('cores do tema %s', (_nome, c) => {
  const fundos = { background: c.background, surface: c.surface, surfaceAlt: c.surfaceAlt };

  test.each(Object.entries(fundos))('texto legível sobre %s', (_f, fundo) => {
    expect(contrast(c.text, fundo)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textMuted, fundo)).toBeGreaterThanOrEqual(4.5);
  });

  test('texto sobre a cor principal e sobre a cor de perigo', () => {
    expect(contrast(c.primaryText, c.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.dangerText, c.danger)).toBeGreaterThanOrEqual(4.5);
  });

  test('rótulos de marca (links, chips e abas selecionados)', () => {
    expect(contrast(c.primaryInk, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.primaryInk, c.primarySoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.primaryInk, c.background)).toBeGreaterThanOrEqual(4.5);
  });

  test('cor principal como elemento gráfico (FAB, dia selecionado)', () => {
    expect(contrast(c.primary, c.background)).toBeGreaterThanOrEqual(3);
  });

  test('assinatura em bronze e toast', () => {
    expect(contrast(c.bronzeInk, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.background, c.text)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onCoral, c.coral)).toBeGreaterThanOrEqual(4.5);
  });

  test('avisos legíveis', () => {
    expect(contrast(c.danger, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.danger, c.dangerSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.warning, c.warningSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.success, c.successSoft)).toBeGreaterThanOrEqual(4.5);
  });

  test('borda dos campos visível', () => {
    expect(contrast(c.inputBorder, c.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('cores de agenda', () => {
  test.each(CORES_DE_AGENDA.map((a) => [a.nome, a] as const))('%s visível nos dois temas', (_n, a) => {
    expect(contrast(a.claro, marca.cores.claro.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(a.escuro, marca.cores.escuro.surface)).toBeGreaterThanOrEqual(3);
  });
});
