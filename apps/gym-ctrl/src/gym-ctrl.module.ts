import { Module } from '@nestjs/common';
import { GymCtrlController } from './gym-ctrl.controller';
import { GymCtrlService } from './gym-ctrl.service';

@Module({
  imports: [],
  controllers: [GymCtrlController],
  providers: [GymCtrlService],
})
export class GymCtrlModule {}
