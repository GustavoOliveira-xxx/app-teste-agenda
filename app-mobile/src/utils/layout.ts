// Tamanhos de tela: o mesmo app em celular, tablet e computador.
//
// compact  : celular em pé (menos de 600 de largura)
// medium   : celular deitado, tablet pequeno, janela estreita (600 a 1023)
// expanded : tablet grande deitado, computador (1024 ou mais)

export type LayoutSize = 'compact' | 'medium' | 'expanded';

export const BREAKPOINTS = { medium: 600, sideNav: 768, expanded: 1024 } as const;

/** Largura máxima do conteúdo de formulários e listas (leitura confortável). */
export const CONTENT_MAX_WIDTH = 720;

/** Largura máxima de diálogos e listas de opções em telas largas. */
export const DIALOG_MAX_WIDTH = 520;

export interface Layout {
  width: number;
  size: LayoutSize;
  /** Navegação lateral (em vez das abas embaixo). */
  sideNav: boolean;
  /** Calendário e lista do dia lado a lado. */
  twoPane: boolean;
  /** Diálogos e listas de opções no centro da tela (em vez de subir de baixo). */
  centeredSheets: boolean;
}

export function layoutFor(width: number): Layout {
  const size: LayoutSize =
    width >= BREAKPOINTS.expanded ? 'expanded' : width >= BREAKPOINTS.medium ? 'medium' : 'compact';
  return {
    width,
    size,
    sideNav: width >= BREAKPOINTS.sideNav,
    twoPane: size === 'expanded',
    centeredSheets: size !== 'compact',
  };
}

/** Margem lateral para centralizar um bloco de largura máxima `max` numa tela de largura `width`. */
export function centeredInset(width: number, max: number, min: number): number {
  return Math.max(min, Math.round((width - max) / 2));
}
