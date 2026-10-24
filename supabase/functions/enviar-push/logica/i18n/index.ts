// Cópia gerada de app-mobile/src/i18n/index.ts por scripts/copiar-logica-push.mjs. Não edite aqui.
// Função de tradução: t('auth.loginTitle') devolve o texto em português.
// Parâmetros entre chaves são substituídos: t('sync.pending', { n: 3 }).
import { ptBR, type Dictionary } from './pt-BR.ts';

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;
export type TranslationParams = Record<string, string | number>;

const dictionary: Dictionary = ptBR;

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[part];
    return undefined;
  }, dictionary);
}

/**
 * Plural em português a partir do número `n`: "agenda(s)" vira "agenda" com
 * n = 1 e "agendas" nos demais casos; "alteração(ões)" vira "alterações" e
 * "item(ns)" vira "itens".
 */
export function pluralize(text: string, n: number): string {
  const many = n !== 1;
  return text
    .replace(/mês\(es\)/g, many ? 'meses' : 'mês')
    .replace(/ão\(ões\)/g, many ? 'ões' : 'ão')
    .replace(/m\(ns\)/g, many ? 'ns' : 'm')
    .replace(/\((s|es)\)/g, many ? '$1' : '');
}

export function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  if (typeof params.n === 'number') text = pluralize(text, params.n);
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

export function t(key: TranslationKey, params?: TranslationParams): string {
  const value = lookup(key);
  return typeof value === 'string' ? interpolate(value, params) : key;
}

/** Para chaves montadas em tempo de execução (ex.: rótulos de enumerações). */
export function tDynamic(key: string, params?: TranslationParams): string {
  const value = lookup(key);
  return typeof value === 'string' ? interpolate(value, params) : key;
}

export const strings = dictionary;
