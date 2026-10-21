import { centeredInset, layoutFor } from '../layout';

describe('layoutFor', () => {
  it('celular em pé: abas embaixo, uma coluna, opções sobem de baixo', () => {
    expect(layoutFor(390)).toEqual({
      width: 390,
      size: 'compact',
      sideNav: false,
      twoPane: false,
      centeredSheets: false,
    });
  });

  it('tablet em pé: navegação lateral, uma coluna, diálogos no centro', () => {
    const l = layoutFor(820);
    expect(l.size).toBe('medium');
    expect(l.sideNav).toBe(true);
    expect(l.twoPane).toBe(false);
    expect(l.centeredSheets).toBe(true);
  });

  it('computador: navegação lateral e calendário em duas colunas', () => {
    const l = layoutFor(1280);
    expect(l.size).toBe('expanded');
    expect(l.sideNav).toBe(true);
    expect(l.twoPane).toBe(true);
  });

  it('limites exatos das faixas', () => {
    expect(layoutFor(599).size).toBe('compact');
    expect(layoutFor(600).size).toBe('medium');
    expect(layoutFor(767).sideNav).toBe(false);
    expect(layoutFor(768).sideNav).toBe(true);
    expect(layoutFor(1023).size).toBe('medium');
    expect(layoutFor(1024).size).toBe('expanded');
  });
});

describe('centeredInset', () => {
  it('centraliza o bloco em telas largas e mantém a margem mínima em telas estreitas', () => {
    expect(centeredInset(1280, 560, 16)).toBe(360);
    expect(centeredInset(390, 560, 16)).toBe(16);
  });
});
