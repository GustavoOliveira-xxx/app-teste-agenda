import { needsReview, parseQuickAdd } from '../quickAdd';

const today = '2026-10-23'; // sexta-feira

describe('adição rápida em português', () => {
  it('exemplos do pedido', () => {
    expect(parseQuickAdd('Comprar pão amanhã', today)).toMatchObject({
      kind: 'task',
      title: 'Comprar pão',
      date: '2026-10-24',
      time: null,
    });
    expect(parseQuickAdd('Estudar física sexta às 19h', today)).toMatchObject({
      kind: 'task',
      title: 'Estudar física',
      date: '2026-10-23',
      time: '19:00',
    });
    expect(parseQuickAdd('Reunião com Paulo terça das 14h às 15h', today)).toMatchObject({
      kind: 'event',
      title: 'Reunião com Paulo',
      date: '2026-10-27',
      time: '14:00',
      endTime: '15:00',
    });
    expect(parseQuickAdd('Lembrar do aniversário dia 12', today)).toMatchObject({
      kind: 'reminder',
      title: 'Aniversário',
      date: '2026-11-12',
    });
  });

  it('repetições', () => {
    expect(parseQuickAdd('Revisar orçamento todo dia 5', today)).toMatchObject({
      title: 'Revisar orçamento',
      date: '2026-11-05',
      recurrence: { rule: 'FREQ=MONTHLY;BYMONTHDAY=5', mode: 'calendar' },
    });
    expect(parseQuickAdd('Limpar o filtro a cada 30 dias após a última limpeza', today)).toMatchObject({
      title: 'Limpar o filtro',
      recurrence: { rule: 'FREQ=DAILY;INTERVAL=30', mode: 'completion' },
      date: today,
    });
    expect(parseQuickAdd('Academia todas as segundas e quartas às 7h', today)).toMatchObject({
      title: 'Academia',
      recurrence: { rule: 'FREQ=WEEKLY;BYDAY=MO,WE' },
      date: '2026-10-26',
      time: '07:00',
    });
    expect(parseQuickAdd('Organizar a semana todo domingo', today).recurrence?.rule).toBe(
      'FREQ=WEEKLY;BYDAY=SU',
    );
    expect(parseQuickAdd('Tomar remédio todos os dias às 8h', today).recurrence?.rule).toBe('FREQ=DAILY');
    expect(parseQuickAdd('Ponto dias úteis', today).recurrence?.rule).toBe(
      'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    );
    expect(parseQuickAdd('Pagar condomínio todo mês', today).recurrence?.rule).toBe('FREQ=MONTHLY');
    expect(parseQuickAdd('Trocar a toalha quinzenalmente', today).recurrence?.rule).toBe(
      'FREQ=WEEKLY;INTERVAL=2',
    );
  });

  it('datas', () => {
    expect(parseQuickAdd('Prova 12/11', today).date).toBe('2026-11-12');
    expect(parseQuickAdd('Matrícula 10/01', today).date).toBe('2027-01-10');
    expect(parseQuickAdd('Viagem 15 de dezembro', today).date).toBe('2026-12-15');
    expect(parseQuickAdd('Renovar seguro em 3 dias', today).date).toBe('2026-10-26');
    expect(parseQuickAdd('Ligar daqui a 2 semanas', today).date).toBe('2026-11-06');
    expect(parseQuickAdd('Faxina depois de amanhã', today).date).toBe('2026-10-25');
    expect(parseQuickAdd('Churrasco no fim de semana', today)).toMatchObject({
      title: 'Churrasco',
      date: '2026-10-24',
    });
    expect(parseQuickAdd('Entregar trabalho segunda-feira', today).date).toBe('2026-10-26');
    expect(parseQuickAdd('Feira sexta que vem', today).date).toBe('2026-10-30');
  });

  it('horários', () => {
    expect(parseQuickAdd('Ligar para o banco às 15h30', today)).toMatchObject({ time: '15:30', date: today });
    expect(parseQuickAdd('Almoço com Ana amanhã ao meio-dia', today)).toMatchObject({
      kind: 'event',
      title: 'Almoço com Ana',
      time: '12:00',
      endTime: '13:00',
    });
    expect(parseQuickAdd('Correr amanhã 6:45', today).time).toBe('06:45');
    expect(parseQuickAdd('Pizza hoje às 8 da noite', today)).toMatchObject({ time: '20:00', title: 'Pizza' });
    expect(parseQuickAdd('Aula 19h-21h', today)).toMatchObject({
      kind: 'event',
      time: '19:00',
      endTime: '21:00',
    });
  });

  it('prioridade e etiquetas', () => {
    expect(parseQuickAdd('Pagar boleto amanhã !! #casa', today)).toMatchObject({
      title: 'Pagar boleto',
      priority: 3,
      tags: ['casa'],
    });
    expect(parseQuickAdd('Enviar relatório urgente', today)).toMatchObject({
      title: 'Enviar relatório',
      priority: 4,
    });
  });

  it('não transforma texto ambíguo em data errada sem avisar', () => {
    const seven = parseQuickAdd('Dentista às 7', today);
    expect(seven.time).toBe('07:00');
    expect(needsReview(seven)).toBe(true);
    const sameDay = parseQuickAdd('Feira sexta', today);
    expect(sameDay.date).toBe(today);
    expect(needsReview(sameDay)).toBe(true);
    const day31 = parseQuickAdd('Pagar aluguel dia 31', '2026-11-05');
    expect(day31.date).toBe('2026-12-31');
    expect(needsReview(day31)).toBe(true);
    expect(parseQuickAdd('Comprar pão', today)).toMatchObject({ date: null, ambiguities: [] });
    expect(needsReview(parseQuickAdd('amanhã às 10h', today))).toBe(true);
  });

  it('palavras comuns não viram data por engano', () => {
    const r = parseQuickAdd('Ter paciência com o mar', today);
    expect(r.date).toBeNull();
    expect(r.title).toBe('Ter paciência com o mar');
    expect(parseQuickAdd('Comprar as frutas', today).title).toBe('Comprar as frutas');
  });
});
