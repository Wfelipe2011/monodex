import {
  buildCategoryAverages,
  coalesceReviews,
  computeY,
  excludeUsedPhones,
  isPremium,
  leadMatchesTenantCategories,
  MixLeadFields,
  premiumTier,
  selectStratifiedBatch,
  uniqueByPhone,
} from './premium-mix';

function lead(partial: Partial<MixLeadFields> & { phone: string }): MixLeadFields {
  return {
    rating: null,
    reviews: null,
    categories: [],
    category: '',
    ...partial,
  };
}

describe('leadMatchesTenantCategories', () => {
  it('aceita lead multi-categoria quando o tenant tem só uma delas', () => {
    expect(
      leadMatchesTenantCategories(
        { categories: ['Construtoras', 'Consultorias'], category: 'Construtoras' },
        ['Construtoras'],
      ),
    ).toBe(true);
  });

  it('aceita lead antigo só com category e categories vazio', () => {
    expect(
      leadMatchesTenantCategories({ categories: [], category: 'X' }, ['X']),
    ).toBe(true);
  });

  it('rejeita quando não há interseção', () => {
    expect(
      leadMatchesTenantCategories(
        { categories: ['Consultorias'], category: 'Consultorias' },
        ['Construtoras'],
      ),
    ).toBe(false);
  });
});

describe('uniqueByPhone / excludeUsedPhones', () => {
  it('dois leads mesmo phone em cidades diferentes viram um só no pool', () => {
    const pool = uniqueByPhone([
      lead({ phone: '12999990000', category: 'Construtoras', categories: ['Construtoras'] }),
      lead({ phone: '12999990000', category: 'Construtoras', categories: ['Construtoras'] }),
      lead({ phone: '12988880000', category: 'Construtoras', categories: ['Construtoras'] }),
    ]);
    const phones = pool.map((item) => item.phone);
    expect(phones).toHaveLength(2);
    expect(new Set(phones).size).toBe(2);
  });

  it('exclui clone de outra cidade se o phone já está no histórico do tenant', () => {
    const used = new Set(['12999990000']);
    const remaining = excludeUsedPhones(
      [
        lead({ phone: '12999990000', category: 'Construtoras' }),
        lead({ phone: '12988880000', category: 'Construtoras' }),
      ],
      used,
    );
    expect(remaining.map((item) => item.phone)).toEqual(['12988880000']);
  });

  it('outro tenant ainda pode contactar o mesmo phone (filtro é por set do tenant)', () => {
    const otherTenantUsed = new Set<string>();
    const remaining = excludeUsedPhones(
      [lead({ phone: '12999990000', category: 'Construtoras' })],
      otherTenantUsed,
    );
    expect(remaining).toHaveLength(1);
  });
});

describe('classificador premium', () => {
  it('coalesceReviews trata 0 e null como 1', () => {
    expect(coalesceReviews(null)).toBe(1);
    expect(coalesceReviews(0)).toBe(1);
    expect(coalesceReviews(12)).toBe(12);
  });

  it('premiumTier: 4.7→5, 4.4→4, 4.5→5, 3.9→null', () => {
    expect(premiumTier(4.7)).toBe(5);
    expect(premiumTier(4.4)).toBe(4);
    expect(premiumTier(4.5)).toBe(5);
    expect(premiumTier(3.9)).toBe(null);
    expect(premiumTier(null)).toBe(null);
  });

  it('4.7 + reviews no sarrafo de 10% → premium', () => {
    const avgByCategory = new Map([['Construtoras', 100]]);
    expect(
      isPremium(
        lead({
          phone: '1',
          rating: 4.7,
          reviews: 10,
          categories: ['Construtoras'],
          category: 'Construtoras',
        }),
        avgByCategory,
        ['Construtoras'],
      ),
    ).toBe(true);
  });

  it('3.9 nunca é premium', () => {
    const avgByCategory = new Map([['Construtoras', 100]]);
    expect(
      isPremium(
        lead({
          phone: '1',
          rating: 3.9,
          reviews: 10_000,
          categories: ['Construtoras'],
          category: 'Construtoras',
        }),
        avgByCategory,
        ['Construtoras'],
      ),
    ).toBe(false);
  });

  it('4.4 no sarrafo de 5% → premium', () => {
    const avgByCategory = new Map([['Construtoras', 100]]);
    expect(
      isPremium(
        lead({
          phone: '1',
          rating: 4.4,
          reviews: 5,
          categories: ['Construtoras'],
          category: 'Construtoras',
        }),
        avgByCategory,
        ['Construtoras'],
      ),
    ).toBe(true);
  });

  it('média usa as duas cidades da mesma categoria', () => {
    const averages = buildCategoryAverages(
      [
        { categories: ['Construtoras'], category: 'Construtoras', reviews: 10 },
        { categories: ['Construtoras'], category: 'Construtoras', reviews: 30 },
      ],
      ['Construtoras'],
    );
    expect(averages.get('Construtoras')).toBe(20);
  });
});

describe('lote estratificado', () => {
  it('P=10, R=90, X=10 → Y=1 (1 premium + 9 comuns)', () => {
    expect(computeY(10, 90, 10)).toBe(1);
    const premium = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` }));
    const regular = Array.from({ length: 90 }, (_, i) => ({ id: `r${i}` }));
    const batch = selectStratifiedBatch(premium, regular, 10, 1);
    const premiumCount = batch.filter((item) => item.id.startsWith('p')).length;
    const regularCount = batch.filter((item) => item.id.startsWith('r')).length;
    expect(batch).toHaveLength(10);
    expect(premiumCount).toBe(1);
    expect(regularCount).toBe(9);
  });

  it('P=0 → só comuns', () => {
    expect(computeY(0, 90, 10)).toBe(0);
    const regular = Array.from({ length: 90 }, (_, i) => ({ id: `r${i}` }));
    const batch = selectStratifiedBatch([], regular, 10, 0);
    expect(batch).toHaveLength(10);
    expect(batch.every((item) => item.id.startsWith('r'))).toBe(true);
  });

  it('P grande e R>0 → lote não é 100% premium', () => {
    const Y = computeY(50, 5, 10);
    expect(Y).toBeLessThanOrEqual(9);
    const premium = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}` }));
    const regular = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}` }));
    const batch = selectStratifiedBatch(premium, regular, 10, Y);
    expect(batch.some((item) => item.id.startsWith('r'))).toBe(true);
    expect(batch.filter((item) => item.id.startsWith('p')).length).toBeLessThan(10);
  });
});
