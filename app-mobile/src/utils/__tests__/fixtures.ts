// Dados de teste reutilizáveis (fictícios).
import type { CalendarEvent } from '@/models/types';

export function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    calendar_id: 'cal-1',
    title: 'Evento',
    description: null,
    location: null,
    address: null,
    url: null,
    all_day: false,
    starts_at: '2026-11-10T22:00:00.000Z',
    ends_at: '2026-11-10T23:00:00.000Z',
    start_date: null,
    end_date: null,
    timezone: 'America/Sao_Paulo',
    recurrence_rule: null,
    created_by: 'user-a',
    assignee_id: null,
    color: null,
    event_type: 'appointment',
    status: 'confirmed',
    privacy: 'members',
    version: 1,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    updated_by: null,
    completed_at: null,
    is_masked: false,
    exceptions: [],
    attendee_ids: [],
    my_reminders: [],
    ...overrides,
  };
}
