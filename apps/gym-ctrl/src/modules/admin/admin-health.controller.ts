import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import { ApiPlatformSuperAdminErrors } from '../../swagger/api-route-errors.decorator';
import { PlatformHealthResponseDto } from './dto/swagger/tenant.swagger.dto';

@ApiTags('Platform')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('platform')
export class AdminHealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check da plataforma (requer SUPER_ADMIN)' })
  @ApiOkResponse({ type: PlatformHealthResponseDto })
  @ApiPlatformSuperAdminErrors()
  health() {
    return {
      status: 'ok',
      module: 'platform',
      timestamp: new Date().toISOString(),
    };
  }
}
