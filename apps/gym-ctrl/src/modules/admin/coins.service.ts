import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CoinTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { CreditCoinDto } from './dto/credit-coin.dto';
import { DebitCoinDto } from './dto/debit-coin.dto';

const coinSelect = {
  userId: true,
  balance: true,
  uuid: true,
} satisfies Prisma.CoinSelect;

const transactionSelect = {
  id: true,
  userId: true,
  tenantId: true,
  amount: true,
  type: true,
  description: true,
  createdAt: true,
  leadId: true,
} satisfies Prisma.CoinTransactionSelect;

@Injectable()
export class CoinsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCoins(tenantId: number) {
    await this.ensureTenant(tenantId);
    return this.prisma.coin.findMany({
      where: { tenantId },
      select: coinSelect,
      orderBy: { userId: 'asc' },
    });
  }

  async listTransactions(tenantId: number, limit = 50) {
    await this.ensureTenant(tenantId);
    const take = Math.min(Math.max(limit, 1), 200);
    return this.prisma.coinTransaction.findMany({
      where: { tenantId },
      select: transactionSelect,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async credit(tenantId: number, dto: CreditCoinDto, operatorUserId: number) {
    if (!(dto.amount > 0)) {
      throw new BadRequestException('amount deve ser maior que 0');
    }
    await this.ensureTenantUser(tenantId, dto.userId);
    const description = this.withOperatorMarker(dto.description, operatorUserId);
    const type = dto.type ?? CoinTransactionType.CREDITO;

    return this.prisma.$transaction(async (tsx) => {
      const existing = await tsx.coin.findUnique({
        where: {
          userId_tenantId: { userId: dto.userId, tenantId },
        },
      });

      const coin = existing
        ? await tsx.coin.update({
            where: { userId_tenantId: { userId: dto.userId, tenantId } },
            data: { balance: { increment: dto.amount } },
            select: coinSelect,
          })
        : await tsx.coin.create({
            data: {
              userId: dto.userId,
              tenantId,
              balance: dto.amount,
            },
            select: coinSelect,
          });

      const transaction = await tsx.coinTransaction.create({
        data: {
          userId: dto.userId,
          tenantId,
          type,
          amount: dto.amount,
          description,
        },
        select: transactionSelect,
      });

      return { coin, transaction };
    });
  }

  async debit(tenantId: number, dto: DebitCoinDto, operatorUserId: number) {
    if (!(dto.amount > 0)) {
      throw new BadRequestException('amount deve ser maior que 0');
    }
    await this.ensureTenantUser(tenantId, dto.userId);
    const description = this.withOperatorMarker(dto.description, operatorUserId);

    return this.prisma.$transaction(async (tsx) => {
      const existing = await tsx.coin.findUnique({
        where: {
          userId_tenantId: { userId: dto.userId, tenantId },
        },
      });

      if (!existing || existing.balance < dto.amount) {
        throw new BadRequestException('Saldo insuficiente');
      }

      const coin = await tsx.coin.update({
        where: { userId_tenantId: { userId: dto.userId, tenantId } },
        data: { balance: { decrement: dto.amount } },
        select: coinSelect,
      });

      const transaction = await tsx.coinTransaction.create({
        data: {
          userId: dto.userId,
          tenantId,
          type: CoinTransactionType.DEBITO,
          amount: -dto.amount,
          description,
        },
        select: transactionSelect,
      });

      return { coin, transaction };
    });
  }

  private withOperatorMarker(description: string | undefined, operatorUserId: number): string {
    const marker = `bySuperAdmin:${operatorUserId}`;
    const base = description?.trim();
    return base ? `${base} | ${marker}` : marker;
  }

  private async ensureTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
  }

  private async ensureTenantUser(tenantId: number, userId: number) {
    await this.ensureTenant(tenantId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException(
        `User ${userId} não encontrado no tenant ${tenantId}`,
      );
    }
  }
}
