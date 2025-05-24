import { Module } from '@nestjs/common';
import { GymCtrlController } from './gym-ctrl.controller';
import { GymCtrlService } from './gym-ctrl.service';
import { PrismaModule } from '@core/infra';

@Module({
  imports: [PrismaModule],
  controllers: [GymCtrlController],
  providers: [GymCtrlService],
})
export class GymCtrlModule {}
