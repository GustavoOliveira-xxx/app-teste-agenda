import { pluralize, t } from '@/i18n';

describe('plural', () => {
  it('escolhe singular ou plural pelo número', () => {
    expect(t('today.synced', { n: 1 })).toBe('Tudo sincronizado · 1 agenda');
    expect(t('today.synced', { n: 4 })).toBe('Tudo sincronizado · 4 agendas');
    expect(t('sync.pending', { n: 1 })).toBe('1 alteração aguardando envio');
    expect(t('sync.pending', { n: 2 })).toBe('2 alterações aguardando envio');
    expect(t('calendarView.eventsCount', { n: 0 })).toBe('0 eventos');
  });

  it('trata "mês(es)" e deixa o resto do texto como está', () => {
    expect(pluralize('a cada mês(es)', 3)).toBe('a cada meses');
    expect(pluralize('{n} item(ns)', 0)).toBe('{n} itens');
    expect(pluralize('{n} item(ns)', 1)).toBe('{n} item');
    expect(pluralize('convidado(a)', 2)).toBe('convidado(a)');
  });
});
