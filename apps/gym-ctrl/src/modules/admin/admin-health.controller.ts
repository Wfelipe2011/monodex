import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';

@ApiTags('Platform')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('platform')
export class AdminHealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check da plataforma (requer SUPER_ADMIN)' })
  health() {
    return {
      status: 'ok',
      module: 'platform',
      timestamp: new Date().toISOString(),
    };
  }
}
