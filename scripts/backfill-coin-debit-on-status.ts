/**
 * One-shot backfill for configurable-coin-debit-on-status (design D7).
 *
 * Reconciles legacy Graph-200 debits with the new webhook billing model:
 * 1. failed + legacy debit → CREDITO + coinRefundedAt (+ synthetic coinDebitedAt)
 * 2. trigger ∈ {delivered,read} + lastStatus null|sent + legacy debit → refund
 * 3. delivered|read + legacy debit → stamp coinDebitedAt only (no new DEBITO)
 * 4. city failed → contacted=false
 *
 * Idempotent: second real run creates zero extra CREDITO/DEBITO.
 * Dry-run prints counts without writing.
 *
 * Usage:
 *   npx ts-node scripts/backfill-coin-debit-on-status.ts --dry-run
 *   npx ts-node scripts/backfill-coin-debit-on-status.ts
 *   npx ts-node scripts/backfill-coin-debit-on-status.ts --tenant-id=8 --dry-run
 *
 * Or: npm run backfill:coin-debit-on-status -- --dry-run
 */
import 'dotenv/config';
import {
  CoinDebitOnStatus,
  CoinTransactionType,
  Prisma,
  PrismaClient,
  WhatsappDeliveryStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const LIST_DEBIT_RE = /^Campanha de lista (\d+) — lead (\d+)$/;

type Counts = {
  cityRefunded: number;
  cityStamped: number;
  cityReopened: number;
  listRefunded: number;
  listStamped: number;
  orphansLogged: number;
  skipped: number;
};

type LegacyDebit = {
  id: number;
  userId: number;
  amount: number;
  leadId: number | null;
  description: string | null;
  createdAt: Date;
};

function parseArgs(argv: string[]): {
  dryRun: boolean;
  tenantId: number | null;
} {
  let dryRun = false;
  let tenantId: number | null = null;
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    const m = /^--tenant-id=(\d+)$/.exec(arg);
    if (m) {
      tenantId = Number(m[1]);
    }
  }
  return { dryRun, tenantId };
}

function emptyCounts(): Counts {
  return {
    cityRefunded: 0,
    cityStamped: 0,
    cityReopened: 0,
    listRefunded: 0,
    listStamped: 0,
    orphansLogged: 0,
    skipped: 0,
  };
}

function absDebitAmount(tx: LegacyDebit, fallback: number): number {
  const fromTx = Math.abs(tx.amount);
  if (fromTx > 0) {
    return fromTx;
  }
  return fallback > 0 ? fallback : 0;
}

function isEarlyStatus(
  status: WhatsappDeliveryStatus | null,
): boolean {
  return status == null || status === WhatsappDeliveryStatus.sent;
}

function isBillableStatus(
  status: WhatsappDeliveryStatus | null,
): boolean {
  return (
    status === WhatsappDeliveryStatus.delivered ||
    status === WhatsappDeliveryStatus.read
  );
}

async function resolveWalletUserId(
  tx: Prisma.TransactionClient,
  tenantId: number,
  preferredUserId?: number,
): Promise<number | null> {
  if (preferredUserId != null) {
    return preferredUserId;
  }
  const coin = await tx.coin.findFirst({
    where: { tenantId },
    select: { userId: true },
  });
  if (coin?.userId != null) {
    return coin.userId;
  }
  const user = await tx.user.findFirst({
    where: { tenantId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function main(): Promise<void> {
  const { dryRun, tenantId: onlyTenantId } = parseArgs(process.argv.slice(2));
  const counts = emptyCounts();
  const matchedDebitIds = new Set<number>();

  console.log(
    `[backfill-coin-debit-on-status] start dryRun=${dryRun}` +
      (onlyTenantId != null ? ` tenantId=${onlyTenantId}` : ' tenantId=ALL'),
  );

  const tenants = await prisma.tenant.findMany({
    where: onlyTenantId != null ? { id: onlyTenantId } : undefined,
    select: {
      id: true,
      name: true,
      outreachConfig: {
        select: {
          coinDebitOnStatus: true,
          costPerLead: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  for (const tenant of tenants) {
    const trigger =
      tenant.outreachConfig?.coinDebitOnStatus ?? CoinDebitOnStatus.delivered;
    const costPerLead = tenant.outreachConfig?.costPerLead ?? 0;
    console.log(
      `[tenant ${tenant.id} ${tenant.name}] trigger=${trigger} costPerLead=${costPerLead}`,
    );

    await backfillCityTenant({
      tenantId: tenant.id,
      trigger,
      costPerLead,
      dryRun,
      counts,
      matchedDebitIds,
    });

    await backfillListTenant({
      tenantId: tenant.id,
      trigger,
      dryRun,
      counts,
      matchedDebitIds,
    });
  }

  await logOrphanDebits({
    onlyTenantId,
    matchedDebitIds,
    counts,
  });

  console.log('[backfill-coin-debit-on-status] summary', {
    dryRun,
    ...counts,
  });
}

async function backfillCityTenant(args: {
  tenantId: number;
  trigger: CoinDebitOnStatus;
  costPerLead: number;
  dryRun: boolean;
  counts: Counts;
  matchedDebitIds: Set<number>;
}): Promise<void> {
  const { tenantId, trigger, costPerLead, dryRun, counts, matchedDebitIds } =
    args;

  const leads = await prisma.tenantLead.findMany({
    where: {
      tenantId,
      OR: [
        { messageId: { not: null } },
        { contacted: true },
        { lastStatus: { not: null } },
      ],
    },
    select: {
      id: true,
      leadId: true,
      messageId: true,
      lastStatus: true,
      contacted: true,
      coinDebitedAt: true,
      coinRefundedAt: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  });

  const debits = await prisma.coinTransaction.findMany({
    where: {
      tenantId,
      type: CoinTransactionType.DEBITO,
      leadId: { not: null },
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      leadId: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const debitsByLeadId = new Map<number, LegacyDebit[]>();
  for (const d of debits) {
    if (d.leadId == null) continue;
    // Skip new-model descriptions (already stamped by runtime)
    if (
      d.description?.includes('city wamid=') ||
      d.description?.includes('list wamid=') ||
      d.description?.includes('listSendId=')
    ) {
      continue;
    }
    const list = debitsByLeadId.get(d.leadId) ?? [];
    list.push(d);
    debitsByLeadId.set(d.leadId, list);
  }

  const usedDebitIds = new Set<number>();

  for (const lead of leads) {
    const candidates = (debitsByLeadId.get(lead.leadId) ?? []).filter(
      (d) => !usedDebitIds.has(d.id),
    );
    // Prefer description pattern "Lead X ... contatado", else oldest unused debit for leadId
    const legacy =
      candidates.find((d) =>
        (d.description ?? '').toLowerCase().includes('contatado'),
      ) ?? candidates[0] ?? null;

    if (legacy) {
      usedDebitIds.add(legacy.id);
      matchedDebitIds.add(legacy.id);
    }

    const hasLegacy = legacy != null;
    const alreadyDebited = lead.coinDebitedAt != null;
    const alreadyRefunded = lead.coinRefundedAt != null;

    // 4) City failed → reopen
    if (
      lead.lastStatus === WhatsappDeliveryStatus.failed &&
      lead.contacted
    ) {
      counts.cityReopened += 1;
      if (!dryRun) {
        await prisma.tenantLead.update({
          where: { id: lead.id },
          data: { contacted: false },
        });
      }
    }

    // 1) Failed + (legacy debit OR already stamped) without refund
    if (
      lead.lastStatus === WhatsappDeliveryStatus.failed &&
      !alreadyRefunded &&
      (hasLegacy || alreadyDebited)
    ) {
      const amount = legacy
        ? absDebitAmount(legacy, costPerLead)
        : costPerLead;
      if (amount <= 0) {
        counts.skipped += 1;
        console.warn(
          `[orphan-skip] city tenantLeadId=${lead.id} failed but cost/amount=0`,
        );
        continue;
      }
      counts.cityRefunded += 1;
      if (!dryRun) {
        await applyCityRefund({
          tenantId,
          tenantLeadId: lead.id,
          leadId: lead.leadId,
          messageId: lead.messageId,
          amount,
          preferredUserId: legacy?.userId,
          stampDebitedAt:
            lead.coinDebitedAt ?? lead.updatedAt ?? lead.createdAt,
        });
      }
      continue;
    }

    // 2) Early status + legacy debit + trigger delivered/read → refund
    if (
      hasLegacy &&
      isEarlyStatus(lead.lastStatus) &&
      (trigger === CoinDebitOnStatus.delivered ||
        trigger === CoinDebitOnStatus.read) &&
      !alreadyRefunded
    ) {
      const amount = absDebitAmount(legacy!, costPerLead);
      if (amount <= 0) {
        counts.skipped += 1;
        continue;
      }
      counts.cityRefunded += 1;
      if (!dryRun) {
        await applyCityRefund({
          tenantId,
          tenantLeadId: lead.id,
          leadId: lead.leadId,
          messageId: lead.messageId,
          amount,
          preferredUserId: legacy!.userId,
          stampDebitedAt:
            lead.coinDebitedAt ?? lead.updatedAt ?? lead.createdAt,
        });
      }
      continue;
    }

    // 3) delivered/read + legacy debit → stamp only
    //    null/sent + legacy + trigger=sent → stamp (carga alinhada ao modelo novo)
    if (
      hasLegacy &&
      !alreadyDebited &&
      (isBillableStatus(lead.lastStatus) ||
        (isEarlyStatus(lead.lastStatus) &&
          trigger === CoinDebitOnStatus.sent))
    ) {
      counts.cityStamped += 1;
      if (!dryRun) {
        await prisma.tenantLead.update({
          where: { id: lead.id },
          data: {
            coinDebitedAt: lead.updatedAt ?? lead.createdAt,
          },
        });
      }
      continue;
    }

    counts.skipped += 1;
  }
}

async function applyCityRefund(args: {
  tenantId: number;
  tenantLeadId: number;
  leadId: number;
  messageId: string | null;
  amount: number;
  preferredUserId?: number;
  stampDebitedAt: Date;
}): Promise<void> {
  const {
    tenantId,
    tenantLeadId,
    leadId,
    messageId,
    amount,
    preferredUserId,
    stampDebitedAt,
  } = args;

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.tenantLead.findUnique({
      where: { id: tenantLeadId },
      select: { coinDebitedAt: true, coinRefundedAt: true, contacted: true },
    });
    if (fresh?.coinRefundedAt != null) {
      return;
    }

    const userId = await resolveWalletUserId(tx, tenantId, preferredUserId);
    if (userId == null) {
      console.warn(
        `[refund-city] sem carteira/user tenant=${tenantId} tenantLeadId=${tenantLeadId}`,
      );
      return;
    }

    await tx.coin.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { balance: { increment: amount } },
    });
    await tx.coinTransaction.create({
      data: {
        userId,
        tenantId,
        leadId,
        type: CoinTransactionType.CREDITO,
        amount,
        description: `backfill city refund wamid=${messageId ?? 'unknown'} tenantLeadId=${tenantLeadId}`,
      },
    });
    await tx.tenantLead.update({
      where: { id: tenantLeadId },
      data: {
        coinDebitedAt: fresh?.coinDebitedAt ?? stampDebitedAt,
        coinRefundedAt: new Date(),
        contacted: false,
      },
    });
  });
}

async function backfillListTenant(args: {
  tenantId: number;
  trigger: CoinDebitOnStatus;
  dryRun: boolean;
  counts: Counts;
  matchedDebitIds: Set<number>;
}): Promise<void> {
  const { tenantId, trigger, dryRun, counts, matchedDebitIds } = args;

  const sends = await prisma.tenantListSend.findMany({
    where: {
      listLead: { list: { tenantId } },
    },
    select: {
      id: true,
      wamid: true,
      campaignId: true,
      listLeadId: true,
      sentAt: true,
      lastStatus: true,
      coinDebitedAt: true,
      coinRefundedAt: true,
      listLead: {
        select: {
          list: { select: { costPerSend: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const debits = await prisma.coinTransaction.findMany({
    where: {
      tenantId,
      type: CoinTransactionType.DEBITO,
      description: { contains: 'Campanha de lista' },
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      leadId: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  type Parsed = LegacyDebit & { campaignId: number; listLeadId: number };
  const byKey = new Map<string, Parsed[]>();
  for (const d of debits) {
    const m = LIST_DEBIT_RE.exec(d.description ?? '');
    if (!m) continue;
    const parsed: Parsed = {
      ...d,
      campaignId: Number(m[1]),
      listLeadId: Number(m[2]),
    };
    const key = `${parsed.campaignId}:${parsed.listLeadId}`;
    const list = byKey.get(key) ?? [];
    list.push(parsed);
    byKey.set(key, list);
  }

  const usedDebitIds = new Set<number>();

  for (const send of sends) {
    const key = `${send.campaignId}:${send.listLeadId}`;
    const candidates = (byKey.get(key) ?? []).filter(
      (d) => !usedDebitIds.has(d.id),
    );
    // Prefer debit closest to sentAt
    candidates.sort(
      (a, b) =>
        Math.abs(a.createdAt.getTime() - send.sentAt.getTime()) -
        Math.abs(b.createdAt.getTime() - send.sentAt.getTime()),
    );
    const legacy = candidates[0] ?? null;
    if (legacy) {
      usedDebitIds.add(legacy.id);
      matchedDebitIds.add(legacy.id);
    }

    const costPerSend = send.listLead.list.costPerSend;
    const hasLegacy = legacy != null;
    const alreadyDebited = send.coinDebitedAt != null;
    const alreadyRefunded = send.coinRefundedAt != null;

    // 1) Failed + (legacy OR stamped) without refund
    if (
      send.lastStatus === WhatsappDeliveryStatus.failed &&
      !alreadyRefunded &&
      (hasLegacy || alreadyDebited)
    ) {
      const amount = legacy
        ? absDebitAmount(legacy, costPerSend)
        : costPerSend;
      if (amount <= 0) {
        counts.skipped += 1;
        continue;
      }
      counts.listRefunded += 1;
      if (!dryRun) {
        await applyListRefund({
          tenantId,
          listSendId: send.id,
          wamid: send.wamid,
          amount,
          preferredUserId: legacy?.userId,
          stampDebitedAt: send.coinDebitedAt ?? send.sentAt,
        });
      }
      continue;
    }

    // 2) Early status + legacy + trigger delivered/read
    if (
      hasLegacy &&
      isEarlyStatus(send.lastStatus) &&
      (trigger === CoinDebitOnStatus.delivered ||
        trigger === CoinDebitOnStatus.read) &&
      !alreadyRefunded
    ) {
      const amount = absDebitAmount(legacy!, costPerSend);
      if (amount <= 0) {
        counts.skipped += 1;
        continue;
      }
      counts.listRefunded += 1;
      if (!dryRun) {
        await applyListRefund({
          tenantId,
          listSendId: send.id,
          wamid: send.wamid,
          amount,
          preferredUserId: legacy!.userId,
          stampDebitedAt: send.coinDebitedAt ?? send.sentAt,
        });
      }
      continue;
    }

    // 3) delivered/read + legacy → stamp
    //    null/sent + legacy + trigger=sent → stamp
    if (
      hasLegacy &&
      !alreadyDebited &&
      (isBillableStatus(send.lastStatus) ||
        (isEarlyStatus(send.lastStatus) &&
          trigger === CoinDebitOnStatus.sent))
    ) {
      counts.listStamped += 1;
      if (!dryRun) {
        await prisma.tenantListSend.update({
          where: { id: send.id },
          data: { coinDebitedAt: send.sentAt },
        });
      }
      continue;
    }

    counts.skipped += 1;
  }
}

async function applyListRefund(args: {
  tenantId: number;
  listSendId: number;
  wamid: string;
  amount: number;
  preferredUserId?: number;
  stampDebitedAt: Date;
}): Promise<void> {
  const {
    tenantId,
    listSendId,
    wamid,
    amount,
    preferredUserId,
    stampDebitedAt,
  } = args;

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.tenantListSend.findUnique({
      where: { id: listSendId },
      select: { coinDebitedAt: true, coinRefundedAt: true },
    });
    if (fresh?.coinRefundedAt != null) {
      return;
    }

    const userId = await resolveWalletUserId(tx, tenantId, preferredUserId);
    if (userId == null) {
      console.warn(
        `[refund-list] sem carteira/user tenant=${tenantId} listSendId=${listSendId}`,
      );
      return;
    }

    await tx.coin.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { balance: { increment: amount } },
    });
    await tx.coinTransaction.create({
      data: {
        userId,
        tenantId,
        type: CoinTransactionType.CREDITO,
        amount,
        description: `backfill list refund wamid=${wamid} listSendId=${listSendId}`,
      },
    });
    await tx.tenantListSend.update({
      where: { id: listSendId },
      data: {
        coinDebitedAt: fresh?.coinDebitedAt ?? stampDebitedAt,
        coinRefundedAt: new Date(),
      },
    });
  });
}

async function logOrphanDebits(args: {
  onlyTenantId: number | null;
  matchedDebitIds: Set<number>;
  counts: Counts;
}): Promise<void> {
  const { onlyTenantId, matchedDebitIds, counts } = args;

  const candidates = await prisma.coinTransaction.findMany({
    where: {
      type: CoinTransactionType.DEBITO,
      ...(onlyTenantId != null ? { tenantId: onlyTenantId } : {}),
      OR: [
        { leadId: { not: null } },
        { description: { contains: 'Campanha de lista' } },
        { description: { contains: 'contatado' } },
      ],
    },
    select: {
      id: true,
      tenantId: true,
      leadId: true,
      amount: true,
      description: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  });

  for (const d of candidates) {
    if (matchedDebitIds.has(d.id)) continue;
    // New-model runtime debits are not orphans for this backfill
    if (
      d.description?.includes('city wamid=') ||
      d.description?.includes('list wamid=') ||
      d.description?.includes('city refund') ||
      d.description?.includes('list refund') ||
      d.description?.includes('backfill')
    ) {
      continue;
    }
    counts.orphansLogged += 1;
    console.warn(
      `[orphan-debit] id=${d.id} tenantId=${d.tenantId} leadId=${d.leadId} amount=${d.amount} createdAt=${d.createdAt.toISOString()} description=${JSON.stringify(d.description)}`,
    );
  }
}

main()
  .catch((err) => {
    console.error('[backfill-coin-debit-on-status] fatal', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
