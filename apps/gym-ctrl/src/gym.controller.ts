
import { Public } from '@core/decorators/public.decorator';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheckResponseDto } from './modules/admin/dto/swagger/tenant.swagger.dto';

@ApiTags('Verificação de Saúde')
@Controller()
export class GymController {
  logger = new Logger(GymController.name);
  constructor(private prisma: PrismaService) { }

  @Public()
  @Get('/health-check')
  @ApiOperation({ summary: 'Health check público da API' })
  @ApiOkResponse({
    type: HealthCheckResponseDto,
    description: 'API está funcionando corretamente',
  })
  async healthCheck() {

    return {
      status: this.prisma.isConnected,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      message: 'API está funcionando corretamente',
    };
  }
}