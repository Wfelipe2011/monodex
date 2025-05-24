import { Test, TestingModule } from '@nestjs/testing';
import { CapturaController } from './captura.controller';
import { CapturaService } from './captura.service';

describe('CapturaController', () => {
  let capturaController: CapturaController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CapturaController],
      providers: [CapturaService],
    }).compile();

    capturaController = app.get<CapturaController>(CapturaController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(capturaController.getHello()).toBe('Hello World!');
    });
  });
});
