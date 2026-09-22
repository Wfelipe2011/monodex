import { Test, TestingModule } from '@nestjs/testing';
import { CapturaController } from './captura.controller';
import { LeadsService } from './leads.service';

describe('CapturaController', () => {
  let capturaController: CapturaController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CapturaController],
      providers: [{ provide: LeadsService, useValue: {} }],
    }).compile();

    capturaController = app.get<CapturaController>(CapturaController);
  });

  describe('root', () => {
    it('returns health status', async () => {
      await expect(capturaController.healthCheck()).resolves.toEqual({
        status: 'ok',
      });
    });
  });
});
