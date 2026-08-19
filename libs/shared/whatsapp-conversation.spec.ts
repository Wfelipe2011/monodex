import { normalizeListPhone } from './list-campaign-helpers';
import {
  isDedicatedPlatformAccount,
  matchContactProfileName,
  resolveConversationDisplayName,
} from './whatsapp-conversation';

describe('isDedicatedPlatformAccount', () => {
  it('isDefault true → false', () => {
    expect(isDedicatedPlatformAccount({ isDefault: true })).toBe(false);
  });

  it('isDefault false → true', () => {
    expect(isDedicatedPlatformAccount({ isDefault: false })).toBe(true);
  });
});

describe('matchContactProfileName', () => {
  it('casa wa_id e from ignorando formatação', () => {
    expect(
      matchContactProfileName(
        [{ wa_id: '+55 11 999', profile: { name: ' Maria ' } }],
        '5511999',
      ),
    ).toBe('Maria');
    expect(
      matchContactProfileName(
        [{ wa_id: '5511999', profile: { name: 'Maria' } }],
        '+55 11 999',
      ),
    ).toBe('Maria');
  });

  it('contacts undefined ou sem match → null', () => {
    expect(matchContactProfileName(undefined, '5511999')).toBeNull();
    expect(
      matchContactProfileName(
        [{ wa_id: '5511888', profile: { name: 'Outro' } }],
        '5511999',
      ),
    ).toBeNull();
  });

  it('nome vazio após trim → null', () => {
    expect(
      matchContactProfileName(
        [{ wa_id: '5511999', profile: { name: '  ' } }],
        '5511999',
      ),
    ).toBeNull();
  });
});

describe('resolveConversationDisplayName', () => {
  const phone = normalizeListPhone('+55 11 999');

  it('profileName não vazio sobrescreve thread existente', () => {
    expect(
      resolveConversationDisplayName({
        profileName: ' Maria ',
        phone,
        existingDisplayName: phone,
        isNewThread: false,
      }),
    ).toBe('Maria');
  });

  it('thread nova sem nome usa o phone', () => {
    expect(
      resolveConversationDisplayName({
        profileName: null,
        phone,
        isNewThread: true,
      }),
    ).toBe(phone);
  });

  it('inbound seguinte com nome atualiza', () => {
    const created = resolveConversationDisplayName({
      profileName: null,
      phone,
      isNewThread: true,
    });
    expect(created).toBe(phone);
    expect(
      resolveConversationDisplayName({
        profileName: 'Maria',
        phone,
        existingDisplayName: created,
        isNewThread: false,
      }),
    ).toBe('Maria');
  });

  it('thread existente sem nome mantém snapshot', () => {
    expect(
      resolveConversationDisplayName({
        profileName: null,
        phone,
        existingDisplayName: 'João',
        isNewThread: false,
      }),
    ).toBe('João');
  });

  it('thread existente sem snapshot usa o phone', () => {
    expect(
      resolveConversationDisplayName({
        profileName: '',
        phone,
        existingDisplayName: null,
        isNewThread: false,
      }),
    ).toBe(phone);
  });
});
