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
import { CoinsService } from './coins.service';
import { CreditCoinDto } from './dto/credit-coin.dto';
import { DebitCoinDto } from './dto/debit-coin.dto';

@ApiTags('Admin — Coins')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/tenants/:tenantId')
export class CoinsController {
  constructor(private readonly coinsService: CoinsService) {}

  @Get('coins')
  @ApiOperation({ summary: 'Listar saldos de coins do tenant' })
  listCoins(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.coinsService.listCoins(tenantId);
  }

  @Get('coin-transactions')
  @ApiOperation({ summary: 'Listar transactions recentes do tenant' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  listTransactions(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.coinsService.listTransactions(tenantId, limit ?? 50);
  }

  @Post('coins/credit')
  @ApiOperation({ summary: 'Creditar coins (upsert da carteira)' })
  credit(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreditCoinDto,
    @Req() req: RequestUser,
  ) {
    return this.coinsService.credit(tenantId, dto, this.operatorId(req));
  }

  @Post('coins/debit')
  @ApiOperation({ summary: 'Debitar coins (amount > 0; row com amount negativo)' })
  debit(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: DebitCoinDto,
    @Req() req: RequestUser,
  ) {
    return this.coinsService.debit(tenantId, dto, this.operatorId(req));
  }

  private operatorId(req: RequestUser): number {
    return req.user.userId ?? req.user.id;
  }
}
