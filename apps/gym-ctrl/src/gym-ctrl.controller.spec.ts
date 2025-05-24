import { Test, TestingModule } from '@nestjs/testing';
import { GymCtrlController } from './gym-ctrl.controller';
import { GymCtrlService } from './gym-ctrl.service';

describe('GymCtrlController', () => {
  let gymCtrlController: GymCtrlController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [GymCtrlController],
      providers: [GymCtrlService],
    }).compile();

    gymCtrlController = app.get<GymCtrlController>(GymCtrlController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(gymCtrlController.getHello()).toBe('Hello World!');
    });
  });
});
