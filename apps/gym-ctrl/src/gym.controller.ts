
import { Public } from '@core/decorators/public.decorator';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Verificação de Saúde')
@Controller()
export class GymController {
  logger = new Logger(GymController.name);
  constructor(private prisma: PrismaService) { }

  @Public()
  @Get('/health-check')
  async healthCheck() {

    return {
      status: this.prisma.isConnected,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      message: 'API está funcionando corretamente',
    };
  }
}