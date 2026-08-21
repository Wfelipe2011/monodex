import { ForbiddenException } from '@nestjs/common';
import { Roles } from '@prisma/client';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

describe('MediaController.upload Super Admin', () => {
  it('POST 403 e remove arquivo se Super Admin', async () => {
    const mediaService = {
      safeUnlink: jest.fn().mockResolvedValue(undefined),
      saveUpload: jest.fn(),
    };
    const controller = new MediaController(
      mediaService as unknown as MediaService,
    );
    const file = {
      path: '/tmp/x.png',
      originalname: 'x.png',
      mimetype: 'image/png',
      size: 10,
    };
    const req = {
      user: { roles: [Roles.SUPER_ADMIN] },
    };

    await expect(
      controller.upload(4, file, req as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mediaService.safeUnlink).toHaveBeenCalledWith('/tmp/x.png');
    expect(mediaService.saveUpload).not.toHaveBeenCalled();
  });
});
