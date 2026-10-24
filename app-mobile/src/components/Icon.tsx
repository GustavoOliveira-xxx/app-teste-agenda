// Ícones de interface SynCK: grade 24, traço 2, pontas arredondadas.
// Os 23 primeiros vêm do pacote de identidade (05-elementos-graficos/
// icones-interface); os demais foram desenhados no mesmo traço para cobrir o
// resto do app. Nenhuma outra biblioteca de ícones é usada.
import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useAppTheme } from '@/theme/ThemeProvider';

type Part =
  | { d: string }
  | { c: [number, number, number]; fill?: 'cur' | 'accent' }
  | { r: [number, number, number, number, number] };

const dot = (cx: number, cy: number, r = 1): Part => ({ c: [cx, cy, r], fill: 'cur' });
const accent = (cx: number, cy: number, r: number): Part => ({ c: [cx, cy, r], fill: 'accent' });
const cloud = 'M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.5a4.5 4.5 0 0 0 0 9z';
const bell = 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0';

const GLYPHS = {
  // Pacote de identidade
  agendas: [
    { c: [9, 9, 3.2] },
    { d: 'M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5' },
    { c: [16.5, 8, 2.6] },
    { d: 'M16.2 13.2c2.4.1 4 1.9 4.4 4.8' },
  ],
  alerta: [{ d: 'M12 4l9 16H3z' }, { d: 'M12 10v4' }, dot(12, 17)],
  avancar: [{ d: 'M9.5 5.5L16 12l-6.5 6.5' }],
  busca: [{ c: [11, 11, 6.5] }, { d: 'M16 16l4.5 4.5' }],
  cadeado: [{ r: [5, 10.5, 14, 10, 2.5] }, { d: 'M8 10.5V8a4 4 0 0 1 8 0v2.5' }],
  calendario: [
    { r: [3.5, 5, 17, 15.5, 3.5] },
    { d: 'M3.5 10h17M8 3v4M16 3v4' },
    dot(8, 14),
    dot(12, 14),
    dot(16, 14),
    dot(8, 17.5),
    dot(12, 17.5),
  ],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }],
  convite: [
    { c: [10, 8.5, 3.5] },
    { d: 'M3.5 20c.8-3.6 3.4-5.8 6.5-5.8 1.4 0 2.6.4 3.6 1.1M18 13v6M15 16h6' },
  ],
  email: [{ r: [3.5, 5.5, 17, 13, 2.5] }, { d: 'M4.5 7l7.5 6 7.5-6' }],
  fechar: [{ d: 'M6 6l12 12M18 6L6 18' }],
  hoje: [{ r: [4, 5, 16, 15, 3.5] }, { d: 'M4 10h16M9 3v4M15 3v4' }, accent(12, 15, 1.8)],
  link: [
    {
      d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    },
  ],
  local: [{ d: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z' }, { c: [12, 10, 2.3] }],
  maisH: [dot(6, 12, 1.3), dot(12, 12, 1.3), dot(18, 12, 1.3)],
  mais: [{ d: 'M12 5v14M5 12h14' }],
  nota: [{ d: 'M6 4h8.5L19 8.5V20H6z' }, { d: 'M14 4v5h5M9 13h7M9 16.5h5' }],
  olho: [
    { d: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z' },
    { c: [12, 12, 2.8] },
  ],
  perfil: [{ c: [12, 8.5, 3.8] }, { d: 'M4.5 20c1-3.6 4-5.8 7.5-5.8s6.5 2.2 7.5 5.8' }],
  relogio: [{ c: [12, 12, 8.5] }, { d: 'M12 7.5V12l3 2' }],
  repetir: [{ d: 'M4 11a6 6 0 0 1 6-6h8M15 2l3 3-3 3M20 13a6 6 0 0 1-6 6H6M9 22l-3-3 3-3' }],
  sino: [{ d: bell }],
  sync: [
    { d: 'M19 12a7 7 0 0 1-12.4 4.4M5 12a7 7 0 0 1 12.4-4.4M17.6 3.6v4h-4M6.4 20.4v-4h4' },
    accent(12, 12, 1.8),
  ],
  voltar: [{ d: 'M14.5 5.5L8 12l6.5 6.5' }],

  // Complementares, no mesmo traço
  abaixo: [{ d: 'M5.5 9.5L12 16l6.5-6.5' }],
  acima: [{ d: 'M5.5 14.5L12 8l6.5 6.5' }],
  filtroAtivo: [{ d: 'M4 6h16M7 12h10M10 18h4' }, accent(20, 18, 2.2)],
  abrir: [{ d: 'M13.5 4.5h6v6M19.5 4.5l-8 8M18 14v3.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10' }],
  ajuda: [{ c: [12, 12, 8.5] }, { d: 'M9.6 9.6a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.4' }, dot(12, 17)],
  ajustes: [{ d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }, { c: [15, 7, 2] }, { c: [9, 17, 2] }],
  alertaCirculo: [{ c: [12, 12, 8.5] }, { d: 'M12 7.5v5' }, dot(12, 16)],
  arquivo: [{ r: [3.5, 4.5, 17, 4.5, 1.5] }, { d: 'M5 9v8.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4' }],
  atualizar: [{ d: 'M19 12a7 7 0 1 1-2.05-4.95M19.5 4v4h-4' }],
  baixar: [{ d: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14' }],
  bloqueio: [{ c: [12, 12, 8.5] }, { d: 'M6 6l12 12' }],
  bug: [
    { r: [8, 7.5, 8, 12, 4] },
    { d: 'M8 12H4.5M19.5 12H16M8 16.5l-3 1.5M16 16.5l3 1.5M9.5 7.5L8 5M14.5 7.5L16 5' },
  ],
  casa: [{ d: 'M4.5 10.5L12 4.5l7.5 6V18a2 2 0 0 1-2 2h-3v-5.5h-5V20h-3a2 2 0 0 1-2-2z' }],
  celular: [{ r: [7, 3, 10, 18, 2.8] }, { d: 'M11 17.5h2' }],
  chave: [{ c: [8, 15, 4] }, { d: 'M10.8 12.2L19 4M15.5 7.5l2.5 2.5M17.5 5.5l2 2' }],
  checkCirculo: [{ c: [12, 12, 8.5] }, { d: 'M8 12.3l2.7 2.7L16 9.6' }],
  checkDuplo: [{ d: 'M2.5 12.5L7 17l9.5-9.5M12 16.5l.5.5L22 7.5' }],
  comentario: [{ d: 'M5 19V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6a2.5 2.5 0 0 1-2.5 2.5H9z' }],
  compartilhar: [
    { c: [18, 5.5, 2.5] },
    { c: [6, 12, 2.5] },
    { c: [18, 18.5, 2.5] },
    { d: 'M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1' },
  ],
  computador: [{ r: [3.5, 4.5, 17, 11.5, 2.5] }, { d: 'M9 20h6M12 16v4' }],
  copiar: [
    { r: [8.5, 8.5, 11, 11, 2.5] },
    { d: 'M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2' },
  ],
  desfazer: [{ d: 'M9 14L4.5 9.5 9 5M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3' }],
  editar: [{ d: 'M4.5 19.5l1-4.2L15.8 5a2.1 2.1 0 0 1 3 3L8.7 18.3zM13.5 7.3l3 3M13 19.5h6.5' }],
  enviar: [{ d: 'M20.5 3.5L10 14M20.5 3.5l-6.5 17-4-6.5-6.5-4z' }],
  escudo: [
    { d: 'M12 3.5l7 2.8v5.4c0 4.4-3 7.7-7 8.8-4-1.1-7-4.4-7-8.8V6.3z' },
    { d: 'M9 12l2.2 2.2L15.2 10' },
  ],
  fecharCirculo: [{ c: [12, 12, 8.5] }, { d: 'M9 9l6 6M15 9l-6 6' }],
  ferramenta: [
    {
      d: 'M15 4.5a4.5 4.5 0 0 0-4.2 6.1L4.5 16.9a1.9 1.9 0 0 0 2.6 2.6l6.3-6.3A4.5 4.5 0 0 0 19.5 9l-2.8 2.8-2.9-.6-.6-2.9L16 4.6A4.5 4.5 0 0 0 15 4.5z',
    },
  ],
  filtro: [{ d: 'M4 6h16M7 12h10M10 18h4' }],
  lixeira: [
    {
      d: 'M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M10 11v5M14 11v5',
    },
  ],
  maisCirculo: [{ c: [12, 12, 8.5] }, { d: 'M12 8v8M8 12h8' }],
  nuvemOk: [{ d: cloud }, { d: 'M9.5 14l1.8 1.8 3.4-3.4' }],
  nuvemOff: [{ d: cloud }, { d: 'M4 4l16 16' }],
  nuvemSubir: [{ d: cloud }, { d: 'M12 16.5v-5M9.8 13.5l2.2-2.2 2.2 2.2' }],
  olhoFechado: [
    {
      d: 'M4 4l16 16M10.6 5.6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.4 3.2M6.6 7.1C4 8.9 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.8 0 3.4-.5 4.7-1.3M9.9 10a2.8 2.8 0 0 0 4 4',
    },
  ],
  pessoaRemover: [{ c: [10, 8.5, 3.5] }, { d: 'M3.5 20c.8-3.6 3.4-5.8 6.5-5.8 1.4 0 2.6.4 3.6 1.1M15 16h6' }],
  sair: [{ d: 'M10 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h3M14.5 8l4 4-4 4M18.5 12h-9' }],
  sinoAviso: [{ d: bell }, accent(18, 5.5, 2.2)],
  sinoOff: [{ d: bell }, { d: 'M4 4l16 16' }],
  // Versão 3.0: tarefas, listas, hábitos, planejamento
  tarefa: [{ r: [4, 4, 16, 16, 4] }, { d: 'M8 12.3l2.7 2.7L16 9.6' }],
  circulo: [{ c: [12, 12, 8.5] }],
  bandeira: [{ d: 'M5.5 21V4.5M5.5 4.5h11l-2.5 4 2.5 4h-11' }],
  lista: [{ d: 'M9.5 6.5h10M9.5 12h10M9.5 17.5h10' }, dot(5, 6.5, 1.3), dot(5, 12, 1.3), dot(5, 17.5, 1.3)],
  caixa: [{ d: 'M4 13.5l2.5-8h11l2.5 8V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z' }, { d: 'M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20' }],
  folha: [{ d: 'M5 19c0-8 5.5-13.5 14-14 .5 8.5-5 14-13 14z' }, { d: 'M5 19l7-7' }],
  estrela: [{ d: 'M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7z' }],
  grade: [{ r: [3.5, 4.5, 17, 15.5, 3] }, { d: 'M3.5 9.5h17M9.5 9.5V20M15 9.5V20' }],
  linhaTempo: [{ d: 'M7 4v16' }, { c: [7, 8, 2] }, { c: [7, 16, 2] }, { d: 'M11 8h8M11 16h6' }],
  brilho: [
    { d: 'M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5z' },
    accent(19, 18, 1.6),
  ],
  pessoas: [
    { c: [8, 9, 2.8] },
    { c: [16, 9, 2.8] },
    { d: 'M3 18.5c.5-2.6 2.4-4.3 5-4.3s4.5 1.7 5 4.3M11 18.5c.5-2.6 2.4-4.3 5-4.3s4.5 1.7 5 4.3' },
  ],
  enquete: [{ r: [4, 4, 16, 16, 3] }, { d: 'M8 15.5v-3M12 15.5V8.5M16 15.5v-5' }],
  adiar: [{ c: [12, 13, 7.5] }, { d: 'M12 9.5V13l2.5 1.5M5 4.5l2.5-1.5M19 4.5L16.5 3' }],
  sol: [{ c: [12, 12, 4] }, { d: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4' }],
  etiqueta: [{ d: 'M4 12.5V5.5A1.5 1.5 0 0 1 5.5 4h7l7.5 7.5-8.5 8.5z' }, dot(8.5, 8.5, 1.3)],
  importar: [{ d: 'M12 15V4M7.5 10.5L12 15l4.5-4.5M5 19.5h14' }],
  exportar: [{ d: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14' }],
  triste: [
    { c: [12, 12, 8.5] },
    { d: 'M8.5 16c.9-1.2 2.1-1.8 3.5-1.8s2.6.6 3.5 1.8' },
    dot(9.2, 10),
    dot(14.8, 10),
  ],
} satisfies Record<string, Part[]>;

type Glyph = keyof typeof GLYPHS;

/** Nomes usados nas telas e o desenho correspondente. */
const NAMES = {
  add: 'mais',
  'add-circle-outline': 'maisCirculo',
  'albums-outline': 'agendas',
  'alert-circle-outline': 'alertaCirculo',
  'archive-outline': 'arquivo',
  'arrow-undo-outline': 'desfazer',
  'ban-outline': 'bloqueio',
  'bug-outline': 'bug',
  calendar: 'calendario',
  'calendar-clear-outline': 'calendario',
  'calendar-outline': 'calendario',
  'chatbubble-outline': 'comentario',
  checkmark: 'check',
  'checkmark-circle': 'checkCirculo',
  'checkmark-circle-outline': 'checkCirculo',
  'checkmark-done-outline': 'checkDuplo',
  'chevron-back': 'voltar',
  'chevron-down': 'abaixo',
  'chevron-forward': 'avancar',
  'chevron-up': 'acima',
  close: 'fechar',
  'close-circle-outline': 'fecharCirculo',
  'cloud-done-outline': 'nuvemOk',
  'cloud-offline-outline': 'nuvemOff',
  'cloud-upload-outline': 'nuvemSubir',
  'construct-outline': 'ferramenta',
  'copy-outline': 'copiar',
  'create-outline': 'editar',
  'desktop-outline': 'computador',
  'document-text-outline': 'nota',
  'download-outline': 'baixar',
  'ellipsis-horizontal': 'maisH',
  'exit-outline': 'sair',
  'eye-off-outline': 'olhoFechado',
  'eye-outline': 'olho',
  'funnel-outline': 'filtro',
  funnel: 'filtroAtivo',
  'help-circle-outline': 'ajuda',
  'home-outline': 'casa',
  'key-outline': 'chave',
  'link-outline': 'link',
  'location-outline': 'local',
  'lock-closed-outline': 'cadeado',
  'log-out-outline': 'sair',
  'mail-outline': 'email',
  'notifications-off-outline': 'sinoOff',
  'notifications-outline': 'sino',
  'notifications-unread': 'sinoAviso',
  'open-outline': 'abrir',
  'options-outline': 'ajustes',
  'people-outline': 'agendas',
  'person-add-outline': 'convite',
  'person-circle-outline': 'perfil',
  'person-outline': 'perfil',
  'person-remove-outline': 'pessoaRemover',
  'phone-portrait-outline': 'celular',
  refresh: 'atualizar',
  repeat: 'repetir',
  'sad-outline': 'triste',
  search: 'busca',
  send: 'enviar',
  'settings-outline': 'ajustes',
  'share-outline': 'compartilhar',
  'share-social-outline': 'compartilhar',
  'shield-checkmark-outline': 'escudo',
  'shield-outline': 'escudo',
  sync: 'sync',
  'sync-outline': 'sync',
  'time-outline': 'relogio',
  'today-outline': 'hoje',
  'trash-outline': 'lixeira',
  'warning-outline': 'alerta',
  'task-outline': 'tarefa',
  'circle-outline': 'circulo',
  'flag-outline': 'bandeira',
  'list-outline': 'lista',
  'inbox-outline': 'caixa',
  'leaf-outline': 'folha',
  'star-outline': 'estrela',
  'grid-outline': 'grade',
  'timeline-outline': 'linhaTempo',
  'sparkles-outline': 'brilho',
  'group-outline': 'pessoas',
  'poll-outline': 'enquete',
  'snooze-outline': 'adiar',
  'sunny-outline': 'sol',
  'pricetag-outline': 'etiqueta',
  'import-outline': 'importar',
  'export-outline': 'exportar',
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof NAMES;

/** Ícone decorativo (o texto ao lado é que descreve a ação para leitores de tela). */
export const Icon = memo(function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const { colors } = useAppTheme();
  const parts: readonly Part[] = GLYPHS[NAMES[name]];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {parts.map((p, i) => {
        if ('d' in p) return <Path key={i} d={p.d} />;
        if ('r' in p) {
          const [x, y, w, h, rx] = p.r;
          return <Rect key={i} x={x} y={y} width={w} height={h} rx={rx} />;
        }
        const [cx, cy, r] = p.c;
        const fill = p.fill === 'accent' ? colors.coral : p.fill === 'cur' ? color : undefined;
        return <Circle key={i} cx={cx} cy={cy} r={r} fill={fill} stroke={fill ? 'none' : undefined} />;
      })}
    </Svg>
  );
});
