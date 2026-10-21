// Identidade visual do app.
//
// Para aplicar uma identidade própria, mude só este arquivo (e as imagens
// listadas em docs/DESIGN.md). Todas as telas leem daqui: cores,
// fonte, cantos, sombras e alguns detalhes de estilo.
//
// O padrão é propositalmente neutro (tons de cinza, cantos discretos e a fonte
// do próprio sistema), para não brigar com a marca que vier depois.

export interface CoresDoTema {
  /** Fundo das telas. */
  background: string;
  /** Fundo de cartões, campos e barras. */
  surface: string;
  /** Fundo de áreas secundárias (seletor de visão, linhas alternadas). */
  surfaceAlt: string;
  /** Linhas e divisórias. */
  border: string;
  /** Borda de campos de formulário (contraste mínimo de 3:1 com o fundo). */
  inputBorder: string;
  text: string;
  /** Texto secundário (contraste mínimo de 4,5:1 com o fundo). */
  textMuted: string;
  /** Cor principal da marca: botões principais, itens selecionados, links. */
  primary: string;
  /** Texto sobre a cor principal. */
  primaryText: string;
  /** Versão bem clara da cor principal (fundos de itens selecionados). */
  primarySoft: string;
  danger: string;
  /** Texto sobre fundo `danger` (botões de excluir). */
  dangerText: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  /** Contorno de foco (teclado e leitores de tela). */
  focus: string;
  /** Escurecimento atrás de janelas e listas de opções. */
  overlay: string;
  /** Destaque do dia de hoje no calendário. */
  today: string;
}

export type PesoDaFonte = 'regular' | 'medio' | 'semi' | 'negrito';

export const marca = {
  cores: {
    claro: {
      background: '#FAFAFA',
      surface: '#FFFFFF',
      surfaceAlt: '#F1F1F1',
      border: '#E0E0E0',
      inputBorder: '#8C8C8C',
      text: '#171717',
      textMuted: '#5C5C5C',
      primary: '#171717',
      primaryText: '#FFFFFF',
      primarySoft: '#EBEBEB',
      danger: '#B42318',
      dangerText: '#FFFFFF',
      dangerSoft: '#FBEAE9',
      success: '#1E7A44',
      successSoft: '#E6F3EA',
      warning: '#8A5300',
      warningSoft: '#FFF3DC',
      focus: '#171717',
      overlay: 'rgba(0,0,0,0.45)',
      today: '#171717',
    } satisfies CoresDoTema,
    escuro: {
      background: '#121212',
      surface: '#1A1A1A',
      surfaceAlt: '#242424',
      border: '#333333',
      inputBorder: '#707070',
      text: '#EDEDED',
      textMuted: '#A3A3A3',
      primary: '#EDEDED',
      primaryText: '#121212',
      primarySoft: '#2B2B2B',
      danger: '#F28B82',
      dangerText: '#2A0B09',
      dangerSoft: '#3A1F1D',
      success: '#7CD49B',
      successSoft: '#1C3326',
      warning: '#FFC266',
      warningSoft: '#3A2C14',
      focus: '#EDEDED',
      overlay: 'rgba(0,0,0,0.6)',
      today: '#EDEDED',
    } satisfies CoresDoTema,
  },

  fonte: {
    /**
     * Nome de cada peso da fonte. `null` usa a fonte do sistema (Roboto no
     * Android, San Francisco no iPhone e a do navegador no computador).
     * Com uma fonte própria, use os mesmos nomes das chaves de `arquivos`.
     */
    familias: {
      regular: null,
      medio: null,
      semi: null,
      negrito: null,
    } as Record<PesoDaFonte, string | null>,
    /**
     * Arquivos da fonte própria (.ttf ou .otf), guardados em assets/fonts/.
     * Exemplo:
     *   arquivos: {
     *     'MinhaFonte-Regular': require('../../assets/fonts/MinhaFonte-Regular.ttf'),
     *     'MinhaFonte-Bold': require('../../assets/fonts/MinhaFonte-Bold.ttf'),
     *   },
     * e em `familias`: regular: 'MinhaFonte-Regular', negrito: 'MinhaFonte-Bold'.
     */
    arquivos: {} as Record<string, number>,
  },

  /** Arredondamento dos cantos, em pixels. 0 deixa tudo reto. */
  cantos: {
    /** Etiquetas, seletores pequenos. */
    pequeno: 4,
    /** Botões, campos, linhas de evento. */
    medio: 6,
    /** Cartões, janelas e listas de opções. */
    grande: 8,
  },

  /** Sombra leve em cartões e no botão flutuante. */
  sombra: false,

  /** Mostrar ícones dentro dos botões com texto (ex.: "Gerar convite"). */
  iconesNosBotoes: false,

  /** Títulos de seção em letras maiúsculas ("CONVITES DESTA AGENDA"). */
  titulosDeSecaoEmMaiusculas: false,
};
