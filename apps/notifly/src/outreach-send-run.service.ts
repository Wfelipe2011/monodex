import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import {
  OutreachSendRun,
  OutreachSendRunChannel,
  OutreachSendRunClosedReason,
  OutreachSendRunStatus,
  Prisma,
} from '@prisma/client';

const RUN_TTL_MS = 60 * 60 * 1000;

export type OpenCityRunArgs = {
  tenantId: number;
  targetCount: number;
};

export type OpenListRunArgs = {
  tenantId: number;
  campaignId: number;
  targetCount: number;
};

@Injectable()
export class OutreachSendRunService {
  private readonly logger = new Logger(OutreachSendRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  async openCityRun(
    args: OpenCityRunArgs,
  ): Promise<OutreachSendRun | null> {
    const now = new Date();
    await this.closeExpiredOpenRuns({
      channel: OutreachSendRunChannel.CITY,
      tenantId: args.tenantId,
      now,
    });

    const existing = await this.prisma.outreachSendRun.findFirst({
      where: {
        channel: OutreachSendRunChannel.CITY,
        tenantId: args.tenantId,
        status: OutreachSendRunStatus.OPEN,
        expiresAt: { gt: now },
      },
    });
    if (existing) {
      this.logger.log(
        `[openCityRun] skip tenant=${args.tenantId}: OPEN run ${existing.id} ainda válido`,
      );
      return null;
    }

    return this.prisma.outreachSendRun.create({
      data: {
        channel: OutreachSendRunChannel.CITY,
        tenantId: args.tenantId,
        targetCount: args.targetCount,
        expiresAt: new Date(now.getTime() + RUN_TTL_MS),
      },
    });
  }

  async openListRun(
    args: OpenListRunArgs,
  ): Promise<OutreachSendRun | null> {
    const now = new Date();
    await this.closeExpiredOpenRuns({
      channel: OutreachSendRunChannel.LIST,
      campaignId: args.campaignId,
      now,
    });

    const existing = await this.prisma.outreachSendRun.findFirst({
      where: {
        channel: OutreachSendRunChannel.LIST,
        campaignId: args.campaignId,
        status: OutreachSendRunStatus.OPEN,
        expiresAt: { gt: now },
      },
    });
    if (existing) {
      this.logger.log(
        `[openListRun] skip campaign=${args.campaignId}: OPEN run ${existing.id} ainda válido`,
      );
      return null;
    }

    return this.prisma.outreachSendRun.create({
      data: {
        channel: OutreachSendRunChannel.LIST,
        tenantId: args.tenantId,
        campaignId: args.campaignId,
        targetCount: args.targetCount,
        expiresAt: new Date(now.getTime() + RUN_TTL_MS),
      },
    });
  }

  async closeIfExpired(runId: number): Promise<OutreachSendRun | null> {
    const run = await this.prisma.outreachSendRun.findUnique({
      where: { id: runId },
    });
    if (!run) {
      return null;
    }
    return this.ensureOpen(run);
  }

  /**
   * Se expirado, fecha com TTL e retorna null.
   * Se já CLOSED, retorna null. Caso contrário retorna o run OPEN.
   */
  async ensureOpen(
    run: OutreachSendRun,
  ): Promise<OutreachSendRun | null> {
    if (run.status !== OutreachSendRunStatus.OPEN) {
      return null;
    }
    if (new Date() >= run.expiresAt) {
      await this.close(run.id, OutreachSendRunClosedReason.TTL);
      return null;
    }
    return run;
  }

  /**
   * Lock otimista: incrementa tryCount se elegível.
   * Retorna false se !OPEN, expirado, try cap ou charged já no target.
   */
  async beginTry(runId: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.outreachSendRun.findUnique({
        where: { id: runId },
      });
      if (!run) {
        return false;
      }

      const now = new Date();
      if (run.status !== OutreachSendRunStatus.OPEN) {
        return false;
      }
      if (now >= run.expiresAt) {
        await this.closeInTx(tx, run.id, OutreachSendRunClosedReason.TTL);
        return false;
      }
      if (run.chargedCount >= run.targetCount) {
        await this.closeInTx(
          tx,
          run.id,
          OutreachSendRunClosedReason.TARGET_MET,
        );
        return false;
      }
      if (run.tryCount >= run.targetCount * 3) {
        await this.closeInTx(
          tx,
          run.id,
          OutreachSendRunClosedReason.ATTEMPT_CAP,
        );
        return false;
      }

      const updated = await tx.outreachSendRun.updateMany({
        where: {
          id: runId,
          status: OutreachSendRunStatus.OPEN,
          tryCount: run.tryCount,
        },
        data: { tryCount: { increment: 1 } },
      });
      return updated.count === 1;
    });
  }

  async recordAccept(runId: number): Promise<void> {
    await this.prisma.outreachSendRun.updateMany({
      where: { id: runId, status: OutreachSendRunStatus.OPEN },
      data: { attemptCount: { increment: 1 } },
    });
  }

  async recordCharge(runId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const run = await tx.outreachSendRun.findUnique({
        where: { id: runId },
      });
      if (!run || run.status !== OutreachSendRunStatus.OPEN) {
        return;
      }
      const nextCharged = run.chargedCount + 1;
      if (nextCharged >= run.targetCount) {
        await tx.outreachSendRun.update({
          where: { id: runId },
          data: {
            chargedCount: nextCharged,
            status: OutreachSendRunStatus.CLOSED,
            closedReason: OutreachSendRunClosedReason.TARGET_MET,
          },
        });
        return;
      }
      await tx.outreachSendRun.updateMany({
        where: {
          id: runId,
          status: OutreachSendRunStatus.OPEN,
          chargedCount: run.chargedCount,
        },
        data: { chargedCount: { increment: 1 } },
      });
    });
  }

  async recordChargeReversal(runId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const run = await tx.outreachSendRun.findUnique({
        where: { id: runId },
      });
      if (!run || run.chargedCount <= 0) {
        return;
      }
      await tx.outreachSendRun.update({
        where: { id: runId },
        data: { chargedCount: run.chargedCount - 1 },
      });
    });
  }

  async close(
    runId: number,
    reason: OutreachSendRunClosedReason,
  ): Promise<void> {
    await this.prisma.outreachSendRun.updateMany({
      where: { id: runId, status: OutreachSendRunStatus.OPEN },
      data: {
        status: OutreachSendRunStatus.CLOSED,
        closedReason: reason,
      },
    });
  }

  private async closeInTx(
    tx: Prisma.TransactionClient,
    runId: number,
    reason: OutreachSendRunClosedReason,
  ): Promise<void> {
    await tx.outreachSendRun.updateMany({
      where: { id: runId, status: OutreachSendRunStatus.OPEN },
      data: {
        status: OutreachSendRunStatus.CLOSED,
        closedReason: reason,
      },
    });
  }

  private async closeExpiredOpenRuns(args: {
    channel: OutreachSendRunChannel;
    tenantId?: number;
    campaignId?: number;
    now: Date;
  }): Promise<void> {
    await this.prisma.outreachSendRun.updateMany({
      where: {
        channel: args.channel,
        status: OutreachSendRunStatus.OPEN,
        expiresAt: { lte: args.now },
        ...(args.tenantId != null ? { tenantId: args.tenantId } : {}),
        ...(args.campaignId != null ? { campaignId: args.campaignId } : {}),
      },
      data: {
        status: OutreachSendRunStatus.CLOSED,
        closedReason: OutreachSendRunClosedReason.TTL,
      },
    });
  }
}
