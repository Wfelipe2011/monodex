import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('admin')
export class AdminHealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check do módulo admin (requer SUPER_ADMIN)' })
  health() {
    return {
      status: 'ok',
      module: 'admin',
      timestamp: new Date().toISOString(),
    };
  }
}
