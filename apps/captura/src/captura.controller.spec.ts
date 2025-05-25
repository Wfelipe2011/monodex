import { Test, TestingModule } from '@nestjs/testing';
import { CapturaController } from './captura.controller';
import { CapturaScraperService } from './captura-scraper.service';

describe('CapturaController', () => {
  let capturaController: CapturaController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CapturaController],
      providers: [CapturaScraperService],
    }).compile();

    capturaController = app.get<CapturaController>(CapturaController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(capturaController.getHello()).toBe('Hello World!');
    });
  });
});
