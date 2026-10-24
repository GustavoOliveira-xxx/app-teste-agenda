import { expandEvent } from '@/utils/recurrence';

import { makeEvent, makeTask } from '../../utils/__tests__/fixtures';
import { activeSnoozes, combinePlans, planReminders, planTaskAlerts } from '../localNotifications';

const now = new Date('2026-11-02T12:00:00Z');

describe('alertas de tarefas e lembretes', () => {
  it('usa o prazo com horário, ou 9h do dia sem horário', () => {
    const plan = planTaskAlerts(
      [
        makeTask({ id: 'a', due_date: '2026-11-03', due_time: '14:30:00', my_alerts: [0, 60] }),
        makeTask({ id: 'b', item_type: 'reminder', due_date: '2026-11-04', due_time: null, my_alerts: [0] }),
      ],
      now,
    );
    expect(plan.map((p) => [p.task.id, p.at.toISOString()])).toEqual([
      ['a', '2026-11-03T16:30:00.000Z'],
      ['a', '2026-11-03T17:30:00.000Z'],
      ['b', '2026-11-04T12:00:00.000Z'],
    ]);
  });

  it('ignora concluídas, sem prazo, sem alerta, já passadas e além de 30 dias', () => {
    const plan = planTaskAlerts(
      [
        makeTask({ id: 'feita', status: 'done', due_date: '2026-11-03', my_alerts: [0] }),
        makeTask({ id: 'sem-prazo', my_alerts: [0] }),
        makeTask({ id: 'sem-alerta', due_date: '2026-11-03' }),
        makeTask({ id: 'passou', due_date: '2026-11-01', my_alerts: [0] }),
        makeTask({ id: 'longe', due_date: '2026-12-20', my_alerts: [0] }),
      ],
      now,
    );
    expect(plan).toEqual([]);
  });

  it('eventos e tarefas dividem o limite de agendamentos pelos mais próximos', () => {
    const events = planReminders(
      expandEvent(
        makeEvent({
          starts_at: '2026-11-03T13:00:00.000Z',
          ends_at: '2026-11-03T14:00:00.000Z',
          my_reminders: [0],
        }),
        now,
        new Date('2026-12-01T00:00:00Z'),
      ),
      now,
    );
    const tasks = planTaskAlerts(
      [
        makeTask({ id: 'cedo', due_date: '2026-11-03', due_time: '08:00', my_alerts: [0] }),
        makeTask({ id: 'tarde', due_date: '2026-11-05', due_time: '08:00', my_alerts: [0] }),
      ],
      now,
    );
    const plan = combinePlans(events, tasks, 2);
    expect(plan.tasks.map((t) => t.task.id)).toEqual(['cedo']);
    expect(plan.events).toHaveLength(1);
  });
});

describe('adiar lembrete', () => {
  const snooze = (identifier: string, at: string) => ({
    identifier,
    at,
    title: 'Agora: Dentista',
    body: null,
    data: {},
    category: 'lembrete',
  });

  it('o adiamento sobrevive à sincronização e não duplica o mesmo lembrete', () => {
    const list = [
      snooze('rem:e1:2026-11-02:10:adiado:1', '2026-11-02T12:05:00.000Z'),
      snooze('rem:e1:2026-11-02:10:adiado:2', '2026-11-02T12:10:00.000Z'),
      snooze('task:t1:2026-11-02:0:adiado:1', '2026-11-02T12:08:00.000Z'),
      snooze('rem:e2:2026-11-02:0:adiado:1', '2026-11-02T11:50:00.000Z'),
    ];
    expect(activeSnoozes(list, now).map((s) => s.identifier)).toEqual([
      'task:t1:2026-11-02:0:adiado:1',
      'rem:e1:2026-11-02:10:adiado:2',
    ]);
  });
});
