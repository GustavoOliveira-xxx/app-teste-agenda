import { expandEvent } from '@/utils/recurrence';
import { reminderLabel } from '@/utils/reminders';

import { makeEvent } from '../../utils/__tests__/fixtures';
import { planReminders, reminderTitle } from '../localNotifications';

const now = new Date('2026-11-01T12:00:00Z');
const range = [now, new Date('2027-01-01T00:00:00Z')] as const;

describe('planReminders', () => {
  it('agenda cada lembrete no horário do evento menos a antecedência', () => {
    const occ = expandEvent(makeEvent({ my_reminders: [0, 15, 1440] }), ...range);
    const plan = planReminders(occ, now);
    expect(plan.map((p) => p.at.toISOString())).toEqual([
      '2026-11-09T22:00:00.000Z',
      '2026-11-10T21:45:00.000Z',
      '2026-11-10T22:00:00.000Z',
    ]);
  });

  it('ignora lembretes que já passaram, eventos cancelados e concluídos', () => {
    const soon = makeEvent({
      id: 'soon',
      starts_at: '2026-11-01T12:10:00.000Z',
      ends_at: '2026-11-01T13:00:00.000Z',
      my_reminders: [5, 30],
    });
    const cancelled = makeEvent({ id: 'c', status: 'cancelled', my_reminders: [10] });
    const completed = makeEvent({ id: 'd', status: 'completed', my_reminders: [10] });
    const occ = [soon, cancelled, completed].flatMap((e) => expandEvent(e, ...range));
    const plan = planReminders(occ, now);
    expect(plan).toHaveLength(1);
    expect(plan[0].minutes).toBe(5);
  });

  it('só agenda os próximos 30 dias, inclusive em eventos que se repetem', () => {
    const weekly = makeEvent({ recurrence_rule: 'FREQ=WEEKLY', my_reminders: [60] });
    const plan = planReminders(expandEvent(weekly, ...range), now);
    // Janela: 1º/11 12:00 UTC até 1º/12 12:00 UTC. Entram 10, 17 e 24/11; o de 1º/12 (21:00 UTC) fica fora.
    expect(plan.map((p) => p.occ.originalDate)).toEqual(['2026-11-10', '2026-11-17', '2026-11-24']);
    expect(plan.every((p) => p.at.getTime() - now.getTime() <= 30 * 86_400_000)).toBe(true);
  });

  it('sem lembretes pessoais, nada é agendado', () => {
    expect(planReminders(expandEvent(makeEvent(), ...range), now)).toEqual([]);
  });
});

describe('reminderLabel', () => {
  it('descreve a antecedência em português', () => {
    expect(reminderLabel(0)).toBe('No horário do evento');
    expect(reminderLabel(15)).toBe('15 minutos antes');
    expect(reminderLabel(60)).toBe('1 hora antes');
    expect(reminderLabel(120)).toBe('2 horas antes');
    expect(reminderLabel(1440)).toBe('1 dia antes');
    expect(reminderLabel(2880)).toBe('2 dias antes');
  });
});

describe('reminderTitle', () => {
  it('começa pelo que importa: quanto falta e o nome do evento', () => {
    expect(reminderTitle('Revisão de Cálculo', 30)).toBe('Em 30 min: Revisão de Cálculo');
    expect(reminderTitle('Dentista', 0)).toBe('Agora: Dentista');
    expect(reminderTitle('Dentista', 60)).toBe('Em 1 h: Dentista');
    expect(reminderTitle('Dentista', 90)).toBe('Em 1 h 30 min: Dentista');
    expect(reminderTitle('Dentista', 1440)).toBe('Amanhã, neste horário: Dentista');
    expect(reminderTitle('Viagem', 2880)).toBe('Em 2 dias: Viagem');
  });
});
