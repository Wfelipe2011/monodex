import { PATH_METADATA } from '@nestjs/common/constants';
import { Roles } from '@prisma/client';
import { ROLES_KEY } from '@core/decorators/roles.decorator';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { WhatsappAccountsController } from './whatsapp-accounts.controller';
import { rejectSecretTokenFields } from './reject-secret-token-fields';

describe('WhatsappAccountsController metadata', () => {
  it('path e RolesAuth SUPER_ADMIN only (ADMIN tenant → 403 via guard)', () => {
    expect(Reflect.getMetadata(PATH_METADATA, WhatsappAccountsController)).toBe(
      'platform/whatsapp-accounts',
    );
    expect(Reflect.getMetadata(ROLES_KEY, WhatsappAccountsController)).toEqual([
      Roles.SUPER_ADMIN,
    ]);
    expect(
      Reflect.getMetadata(DECORATORS.API_TAGS, WhatsappAccountsController),
    ).toEqual(['Platform — WhatsApp Accounts']);
  });
});

describe('WhatsappAccountsController business-profile', () => {
  function build() {
    const whatsappAccountsService = {
      getBusinessProfile: jest.fn().mockResolvedValue({ about: 'ok' }),
      patchBusinessProfile: jest.fn().mockResolvedValue({ about: 'ok' }),
      list: jest.fn(),
      create: jest.fn(),
      getById: jest.fn(),
      patch: jest.fn(),
    };
    const controller = new WhatsappAccountsController(
      whatsappAccountsService as never,
    );
    return { controller, whatsappAccountsService };
  }

  it('GET business-profile delega ao service', async () => {
    const { controller, whatsappAccountsService } = build();
    await controller.getBusinessProfile(3);
    expect(whatsappAccountsService.getBusinessProfile).toHaveBeenCalledWith(3);
  });

  it('PATCH business-profile rejeita token no body e delega', async () => {
    const { controller, whatsappAccountsService } = build();
    const body = { about: 'Atendimento 9h–18h' };
    await controller.patchBusinessProfile(3, body, { body } as never);
    expect(whatsappAccountsService.patchBusinessProfile).toHaveBeenCalledWith(
      3,
      body,
    );
  });

  it('PATCH com accessToken → rejectSecretTokenFields (400)', () => {
    expect(() =>
      rejectSecretTokenFields({
        about: 'x',
        accessToken: 'leak',
      }),
    ).toThrow(/accessToken/i);
  });
});
