import { ForbiddenException } from '@nestjs/common';
import { Roles } from '@prisma/client';
import { ApiKeysController } from './api-keys.controller';

describe('ApiKeysController', () => {
  function build() {
    const apiKeysService = {
      create: jest.fn(),
      revoke: jest.fn(),
      list: jest.fn(),
    };
    const controller = new ApiKeysController(apiKeysService as never);
    return { controller, apiKeysService };
  }

  it('POST Super Admin → 403 sem chamar o service', () => {
    const { controller, apiKeysService } = build();
    expect(() =>
      controller.create(
        4,
        { name: 'crm' },
        { user: { roles: [Roles.SUPER_ADMIN] } } as never,
      ),
    ).toThrow(ForbiddenException);
    expect(apiKeysService.create).not.toHaveBeenCalled();
  });

  it('revoke Super Admin → 403 sem chamar o service', () => {
    const { controller, apiKeysService } = build();
    expect(() =>
      controller.revoke(4, 1, {
        user: { roles: [Roles.SUPER_ADMIN] },
      } as never),
    ).toThrow(ForbiddenException);
    expect(apiKeysService.revoke).not.toHaveBeenCalled();
  });

  it('POST Admin chama o service', () => {
    const { controller, apiKeysService } = build();
    apiKeysService.create.mockReturnValue({ id: 1 });
    controller.create(
      4,
      { name: 'crm' },
      { user: { roles: [Roles.ADMIN], tenantId: 4 } } as never,
    );
    expect(apiKeysService.create).toHaveBeenCalledWith(4, 'crm');
  });
});
