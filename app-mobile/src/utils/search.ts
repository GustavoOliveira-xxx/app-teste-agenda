// Busca local em tarefas, lembretes, anotações e agendas (eventos têm busca
// própria no servidor). Sem acento e sem diferença de maiúsculas; "#casa"
// procura a etiqueta; todas as palavras precisam aparecer.
import type { Calendar, DateKey, Note, Task, TaskList } from '@/models/types';

import { isOpen, isOverdue } from './tasks';
import { normalizeText } from './text';

export interface SearchOptions {
  includeDone: boolean;
  onlyOverdue: boolean;
  today: DateKey;
}

export interface ParsedQuery {
  terms: string[];
  tags: string[];
}

export function parseSearch(query: string): ParsedQuery {
  const terms: string[] = [];
  const tags: string[] = [];
  for (const word of normalizeText(query).split(/\s+/).filter(Boolean)) {
    if (word.startsWith('#') && word.length > 1) tags.push(word.slice(1));
    else terms.push(word);
  }
  return { terms, tags };
}

/** A busca tem conteúdo suficiente (2 letras ou uma etiqueta). */
export function isSearchable(query: string): boolean {
  const { terms, tags } = parseSearch(query);
  return tags.length > 0 || terms.join(' ').length >= 2;
}

const matches = (haystack: string, terms: string[]) => terms.every((t) => haystack.includes(t));

export function searchTasks(
  tasks: Task[],
  query: string,
  options: SearchOptions,
  names: { lists?: Record<string, TaskList>; calendars?: Record<string, Calendar> } = {},
): Task[] {
  const { terms, tags } = parseSearch(query);
  if (!terms.length && !tags.length) return [];
  return tasks.filter((task) => {
    if (!options.includeDone && !isOpen(task)) return false;
    if (options.onlyOverdue && !isOverdue(task, options.today)) return false;
    const taskTags = task.tags.map(normalizeText);
    if (!tags.every((tag) => taskTags.some((x) => x.startsWith(tag)))) return false;
    const haystack = normalizeText(
      [
        task.title,
        task.description,
        task.tags.join(' '),
        task.list_id ? names.lists?.[task.list_id]?.name : '',
        task.calendar_id ? names.calendars?.[task.calendar_id]?.name : '',
        task.checklist.map((c) => c.title).join(' '),
      ].join(' '),
    );
    return matches(haystack, terms);
  });
}

export function searchNotes(notes: Note[], query: string): Note[] {
  const { terms, tags } = parseSearch(query);
  if (!terms.length || tags.length) return [];
  return notes.filter((n) => matches(normalizeText(`${n.title ?? ''} ${n.body}`), terms));
}

export function searchCalendars(calendars: Calendar[], query: string): Calendar[] {
  const { terms, tags } = parseSearch(query);
  if (!terms.length || tags.length) return [];
  return calendars.filter(
    (c) => !c.deleted_at && matches(normalizeText(`${c.name} ${c.description ?? ''}`), terms),
  );
}
