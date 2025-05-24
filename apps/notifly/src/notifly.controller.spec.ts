import { Test, TestingModule } from '@nestjs/testing';
import { NotiflyController } from './notifly.controller';
import { NotiflyService } from './notifly.service';

describe('NotiflyController', () => {
  let notiflyController: NotiflyController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [NotiflyController],
      providers: [NotiflyService],
    }).compile();

    notiflyController = app.get<NotiflyController>(NotiflyController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(notiflyController.getHello()).toBe('Hello World!');
    });
  });
});
