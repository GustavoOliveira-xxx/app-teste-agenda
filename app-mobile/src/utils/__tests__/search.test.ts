import type { Calendar, Note } from '@/models/types';

import { isSearchable, parseSearch, searchCalendars, searchNotes, searchTasks } from '../search';

import { makeTask } from './fixtures';

const options = { includeDone: false, onlyOverdue: false, today: '2026-10-24' as const };

describe('busca local', () => {
  const tasks = [
    makeTask({ id: '1', title: 'Comprar pão', tags: ['casa', 'mercado'] }),
    makeTask({ id: '2', title: 'Reunião com o Léo', description: 'Levar relatório', due_date: '2026-10-20' }),
    makeTask({ id: '3', title: 'Pagar conta de luz', status: 'done', tags: ['casa'] }),
  ];

  it('separa palavras e etiquetas', () => {
    expect(parseSearch('Pão #Casa')).toEqual({ terms: ['pao'], tags: ['casa'] });
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable('#c')).toBe(true);
  });

  it('ignora acentos e procura em título e descrição', () => {
    expect(searchTasks(tasks, 'reuniao', options).map((t) => t.id)).toEqual(['2']);
    expect(searchTasks(tasks, 'relatorio leo', options).map((t) => t.id)).toEqual(['2']);
  });

  it('filtra por etiqueta, concluídas e atrasadas', () => {
    expect(searchTasks(tasks, '#casa', options).map((t) => t.id)).toEqual(['1']);
    expect(searchTasks(tasks, '#casa', { ...options, includeDone: true }).map((t) => t.id)).toEqual([
      '1',
      '3',
    ]);
    expect(searchTasks(tasks, 'pao', { ...options, onlyOverdue: true })).toEqual([]);
    expect(searchTasks(tasks, 're', { ...options, onlyOverdue: true }).map((t) => t.id)).toEqual(['2']);
  });

  it('procura em anotações e agendas', () => {
    const notes = [{ id: 'n', title: 'Viagem', body: 'Endereço do hotel' } as Note];
    expect(searchNotes(notes, 'hotel')).toHaveLength(1);
    expect(searchNotes(notes, '#hotel')).toHaveLength(0);
    const calendars = [
      { id: 'c1', name: 'Família', description: null, deleted_at: null } as Calendar,
      { id: 'c2', name: 'Família antiga', description: null, deleted_at: '2026-01-01' } as Calendar,
    ];
    expect(searchCalendars(calendars, 'familia').map((c) => c.id)).toEqual(['c1']);
  });
});
