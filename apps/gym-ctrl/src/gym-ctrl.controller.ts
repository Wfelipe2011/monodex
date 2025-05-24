import { Controller, Get } from '@nestjs/common';
import { GymCtrlService } from './gym-ctrl.service';

@Controller()
export class GymCtrlController {
  constructor(private readonly gymCtrlService: GymCtrlService) {}

  @Get()
  getHello(): string {
    return this.gymCtrlService.getHello();
  }
}
