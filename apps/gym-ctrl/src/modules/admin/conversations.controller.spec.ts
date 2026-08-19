import { ForbiddenException } from '@nestjs/common';
import { Roles } from '@prisma/client';
import { ConversationsController } from './conversations.controller';

describe('ConversationsController', () => {
  it('POST Super Admin → 403 sem chamar o service', () => {
    const conversationsService = {
      sendTextMessage: jest.fn(),
    };
    const controller = new ConversationsController(
      conversationsService as never,
    );

    expect(() =>
      controller.sendTextMessage(7, 88, { text: 'oi' }, {
        user: { roles: [Roles.SUPER_ADMIN] },
        body: { text: 'oi' },
      } as never),
    ).toThrow(ForbiddenException);
    expect(conversationsService.sendTextMessage).not.toHaveBeenCalled();
  });
});
