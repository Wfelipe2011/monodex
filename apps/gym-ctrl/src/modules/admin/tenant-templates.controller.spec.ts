import { ForbiddenException } from '@nestjs/common';
import { Roles } from '@prisma/client';
import { TenantTemplatesController } from './tenant-templates.controller';

describe('TenantTemplatesController — on-demand send', () => {
  it('Super Admin POST → 403 sem chamar service', () => {
    const onDemandSendsService = {
      create: jest.fn(),
    };
    const controller = new TenantTemplatesController(
      { listGrantedTemplates: jest.fn() } as never,
      onDemandSendsService as never,
    );

    expect(() =>
      controller.createSend(
        4,
        10,
        { to: '11999998888' } as never,
        { user: { roles: [Roles.SUPER_ADMIN] }, body: {} } as never,
      ),
    ).toThrow(ForbiddenException);

    expect(onDemandSendsService.create).not.toHaveBeenCalled();
  });
});
