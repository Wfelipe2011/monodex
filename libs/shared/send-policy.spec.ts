import { BadRequestException } from '@nestjs/common';
import {
  asIntArray,
  assertCampaignCityAllowed,
  assertCityPolicyXor,
  cityAllowed,
  cityIdFilter,
  mergeExcludedPhones,
} from './send-policy';

describe('assertCityPolicyXor', () => {
  it('XOR cobre ambos não-vazios', () => {
    expect(() => assertCityPolicyXor([1], [2])).toThrow(BadRequestException);
    expect(() => assertCityPolicyXor([1], [])).not.toThrow();
    expect(() => assertCityPolicyXor([], [2])).not.toThrow();
    expect(() => assertCityPolicyXor([], [])).not.toThrow();
  });
});

describe('assertCampaignCityAllowed', () => {
  it('tenant single-city: cityId diferente rejeita', () => {
    expect(() =>
      assertCampaignCityAllowed(8, {
        allowedCityIds: [7],
        deniedCityIds: [],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertCampaignCityAllowed(7, {
        allowedCityIds: [7],
        deniedCityIds: [],
      }),
    ).not.toThrow();
  });

  it('allowlist multi: cityId fora da lista rejeita', () => {
    expect(() =>
      assertCampaignCityAllowed(3, {
        allowedCityIds: [1, 2],
        deniedCityIds: [],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertCampaignCityAllowed(2, {
        allowedCityIds: [1, 2],
        deniedCityIds: [],
      }),
    ).not.toThrow();
  });

  it('política irrestrita: null cityId e cityId arbitrário ok', () => {
    expect(() =>
      assertCampaignCityAllowed(null, {
        allowedCityIds: [],
        deniedCityIds: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertCampaignCityAllowed(undefined, {
        allowedCityIds: [],
        deniedCityIds: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertCampaignCityAllowed(99, {
        allowedCityIds: [],
        deniedCityIds: [],
      }),
    ).not.toThrow();
  });

  it('allowlist multi: null cityId ok', () => {
    expect(() =>
      assertCampaignCityAllowed(null, {
        allowedCityIds: [1, 2],
        deniedCityIds: [],
      }),
    ).not.toThrow();
  });

  it('denylist: cityId negado rejeita', () => {
    expect(() =>
      assertCampaignCityAllowed(2, {
        allowedCityIds: [],
        deniedCityIds: [2],
      }),
    ).toThrow(BadRequestException);
  });

  it('policy inválida (allow e deny): rejeita antes de cityId', () => {
    expect(() =>
      assertCampaignCityAllowed(1, {
        allowedCityIds: [1],
        deniedCityIds: [2],
      }),
    ).toThrow(BadRequestException);
  });
});

describe('cityAllowed', () => {
  it('allow [1] recusa city 2', () => {
    expect(cityAllowed(2, [1], [])).toBe(false);
    expect(cityAllowed(1, [1], [])).toBe(true);
  });

  it('ambos vazios → sem restrição', () => {
    expect(cityAllowed(99, [], [])).toBe(true);
  });

  it('deny recusa city na lista', () => {
    expect(cityAllowed(2, [], [2])).toBe(false);
    expect(cityAllowed(3, [], [2])).toBe(true);
  });
});

describe('cityIdFilter', () => {
  it('allowlist city 1 não seleciona city 2 (in, sem notIn)', () => {
    expect(cityIdFilter([1], [])).toEqual({ in: [1] });
    expect(cityAllowed(2, [1], [])).toBe(false);
  });

  it('denylist → notIn', () => {
    expect(cityIdFilter([], [2])).toEqual({ notIn: [2] });
    expect(cityAllowed(2, [], [2])).toBe(false);
    expect(cityAllowed(3, [], [2])).toBe(true);
  });

  it('ambos vazios → omitir cityId (igual ao comportamento atual)', () => {
    expect(cityIdFilter([], [])).toBeUndefined();
  });
});

describe('asIntArray', () => {
  it('Json vazio ou inválido vira []', () => {
    expect(asIntArray([])).toEqual([]);
    expect(asIntArray(null)).toEqual([]);
    expect(asIntArray('nope')).toEqual([]);
  });

  it('filtra não-inteiros e ids < 1', () => {
    expect(asIntArray([1, 2.5, 0, '3', -1])).toEqual([1, 3]);
  });
});

describe('mergeExcludedPhones', () => {
  it('união de sets não duplica phones', () => {
    const merged = mergeExcludedPhones({
      own: ['12999990000', '12988880000'],
      pairwise: ['12999990000', '12977770000'],
      allOthersIfRespectAll: ['12988880000'],
      exclusiveTenants: ['12977770000', '12966660000'],
    });
    expect(merged.size).toBe(4);
    expect(merged).toEqual(
      new Set(['12999990000', '12988880000', '12977770000', '12966660000']),
    );
  });

  it('policy vazia: só used phones próprios (seleção igual à atual)', () => {
    const merged = mergeExcludedPhones({
      own: ['used-own'],
      pairwise: [],
      allOthersIfRespectAll: [],
      exclusiveTenants: [],
    });
    expect(merged).toEqual(new Set(['used-own']));
  });

  it('Y contacted P; X respeita Y → P excluído em qualquer cidade (pairwise)', () => {
    const merged = mergeExcludedPhones({
      own: [],
      pairwise: ['P'],
      allOthersIfRespectAll: [],
      exclusiveTenants: [],
    });
    expect(merged.has('P')).toBe(true);
  });

  it('exclusive em Y bloqueia X sem edge', () => {
    const merged = mergeExcludedPhones({
      own: [],
      pairwise: [],
      allOthersIfRespectAll: [],
      exclusiveTenants: ['P'],
    });
    expect(merged.has('P')).toBe(true);
  });

  it('respectAll ∪ exclusive ∪ pairwise', () => {
    const merged = mergeExcludedPhones({
      own: ['own'],
      pairwise: ['pair'],
      allOthersIfRespectAll: ['all', 'pair'],
      exclusiveTenants: ['excl', 'all'],
    });
    expect(merged).toEqual(new Set(['own', 'pair', 'all', 'excl']));
  });
});
