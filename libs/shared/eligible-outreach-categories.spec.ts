import { eligibleOutreachCategories } from './eligible-outreach-categories';

describe('eligibleOutreachCategories', () => {
  const targets = [
    { cityId: 1, category: 'zumba', enabled: true },
    { cityId: 1, category: 'academia', enabled: true },
    { cityId: 2, category: 'academia', enabled: true },
    { cityId: 2, category: 'crossfit', enabled: false },
    { cityId: 3, category: 'yoga', enabled: true },
  ];

  it.each([
    {
      name: 'allow vazio + deny vazio → todas cidades',
      allowed: [] as number[],
      denied: [] as number[],
      expected: ['academia', 'yoga', 'zumba'],
    },
    {
      name: 'allowlist restringe categorias às cidades permitidas',
      allowed: [1],
      denied: [] as number[],
      expected: ['academia', 'zumba'],
    },
    {
      name: 'denylist exclui categorias exclusivas de cidades negadas (crossfit off)',
      allowed: [] as number[],
      denied: [2],
      expected: ['academia', 'yoga', 'zumba'],
    },
    {
      name: 'deny city 3 remove yoga',
      allowed: [] as number[],
      denied: [3],
      expected: ['academia', 'zumba'],
    },
  ])('$name', ({ allowed, denied, expected }) => {
    expect(
      eligibleOutreachCategories({
        allowedCityIds: allowed,
        deniedCityIds: denied,
        targets,
      }),
    ).toEqual(expected);
  });

  it('ignora targets desabilitados', () => {
    expect(
      eligibleOutreachCategories({
        allowedCityIds: [2],
        deniedCityIds: [],
        targets,
      }),
    ).toEqual(['academia']);
  });

  it('retorna lista vazia quando nenhum target passa', () => {
    expect(
      eligibleOutreachCategories({
        allowedCityIds: [99],
        deniedCityIds: [],
        targets,
      }),
    ).toEqual([]);
  });
});
