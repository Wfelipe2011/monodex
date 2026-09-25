import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { CoinsService } from './coins.service';
import { CreditCoinDto } from './dto/credit-coin.dto';
import { DebitCoinDto } from './dto/debit-coin.dto';
import {
  ApiPlatformSuperAdminErrors,
  ApiTenantScopedErrors,
} from '../../swagger/api-route-errors.decorator';
import {
  CoinBalanceResponseDto,
  CoinMutationResponseDto,
  CoinTransactionResponseDto,
} from './dto/swagger/coins.swagger.dto';

@ApiTags('Platform — Coins')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/tenants/:tenantId')
export class CoinsController {
  constructor(private readonly coinsService: CoinsService) {}

  @Get('coins')
  @ApiOperation({ summary: 'Listar saldos de coins do tenant' })
  @ApiOkResponse({ type: CoinBalanceResponseDto, isArray: true })
  @ApiPlatformSuperAdminErrors({ notFound: 'Tenant não encontrado' })
  listCoins(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.coinsService.listCoins(tenantId);
  }

  @Get('coin-transactions')
  @ApiOperation({ summary: 'Listar transactions recentes do tenant' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiOkResponse({ type: CoinTransactionResponseDto, isArray: true })
  @ApiPlatformSuperAdminErrors({ notFound: 'Tenant não encontrado' })
  listTransactions(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.coinsService.listTransactions(tenantId, limit ?? 50);
  }

  @Post('coins/credit')
  @ApiOperation({ summary: 'Creditar coins (upsert da carteira)' })
  @ApiOkResponse({ type: CoinMutationResponseDto })
  @ApiPlatformSuperAdminErrors({
    notFound: 'Tenant ou user não encontrado',
    badRequest: 'amount deve ser maior que 0',
  })
  credit(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreditCoinDto,
    @Req() req: RequestUser,
  ) {
    return this.coinsService.credit(tenantId, dto, this.operatorId(req));
  }

  @Post('coins/debit')
  @ApiOperation({ summary: 'Debitar coins (amount > 0; row com amount negativo)' })
  @ApiOkResponse({ type: CoinMutationResponseDto })
  @ApiPlatformSuperAdminErrors({
    notFound: 'Tenant ou user não encontrado',
    badRequest: 'amount deve ser maior que 0 ou saldo insuficiente',
  })
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

@ApiTags('Tenant — Coins')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@Controller('tenant/:tenantId')
export class TenantCoinsController {
  constructor(private readonly coinsService: CoinsService) {}

  @Get('coins')
  @ApiOperation({ summary: 'Listar saldos de coins do tenant (somente leitura)' })
  @ApiOkResponse({ type: CoinBalanceResponseDto, isArray: true })
  @ApiTenantScopedErrors()
  listCoins(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.coinsService.listCoins(tenantId);
  }

  @Get('coin-transactions')
  @ApiOperation({ summary: 'Listar transactions recentes do tenant (somente leitura)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiOkResponse({ type: CoinTransactionResponseDto, isArray: true })
  @ApiTenantScopedErrors()
  listTransactions(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.coinsService.listTransactions(tenantId, limit ?? 50);
  }
}
