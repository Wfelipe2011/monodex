import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import { TestWhatsappTemplateDto } from './dto/test-whatsapp-template.dto';
import { WhatsappTemplatesService } from './whatsapp-templates.service';

@ApiTags('Admin — WhatsApp Templates')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/whatsapp-templates')
export class WhatsappTemplatesController {
  constructor(
    private readonly whatsappTemplatesService: WhatsappTemplatesService,
  ) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Sincronizar catálogo de templates a partir da WABA da plataforma',
  })
  sync(@Req() req: RequestUser) {
    rejectSecretTokenFields(req.body);
    return this.whatsappTemplatesService.sync();
  }

  @Get()
  @ApiOperation({
    summary: 'Listar templates do catálogo (inclui slots parseados)',
  })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'name', required: false, type: String })
  list(@Query('status') status?: string, @Query('name') name?: string) {
    return this.whatsappTemplatesService.list({ status, name });
  }

  @Post(':id/test')
  @ApiOperation({
    summary: 'Enviar template do catálogo para um número (sem TenantLead/coin)',
  })
  test(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TestWhatsappTemplateDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    const operatorUserId = req.user?.userId ?? req.user?.id;
    return this.whatsappTemplatesService.testSend(id, dto, operatorUserId);
  }
}
