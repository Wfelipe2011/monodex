import {
  advanceBairroCursor,
  sliceBairrosForRun,
} from './on-demand-cursor';

describe('on-demand cursor', () => {
  const bairros = ['a', 'b', 'c', 'd', 'e'];

  it('slices from index for max count', () => {
    expect(sliceBairrosForRun(bairros, 2, 3)).toEqual({
      slice: ['c', 'd', 'e'],
      bairrosProcessed: 3,
    });
  });

  it('wraps cursor after last bairro', () => {
    expect(advanceBairroCursor(4, 5, 1)).toBe(0);
    expect(advanceBairroCursor(3, 5, 2)).toBe(0);
  });

  it('advances without wrap when room remains', () => {
    expect(advanceBairroCursor(0, 5, 2)).toBe(2);
    expect(advanceBairroCursor(2, 5, 2)).toBe(4);
  });
});
