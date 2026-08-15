/**
 * Idempotent seed: platform WhatsappAccount + TenantOutreachConfig for the operational tenant.
 *
 * Tenant resolution:
 * - Uses TENANT_ID env when set
 * - Otherwise defaults to id 8 (current notifly operational tenant)
 * - If that tenant does not exist, exits with instructions to set TENANT_ID
 *
 * Usage: npx ts-node prisma/seed-outreach.ts
 */
import { PrismaClient, WhatsappProvider } from '@prisma/client';

const PLATFORM_PHONE_NUMBER_ID = '1292251013966333';
const DEFAULT_OPERATIONAL_TENANT_ID = 8;

const SCHEDULE = {
  2: [18],
  3: [18],
  4: [13, 18],
};

const CATEGORIES = [
  'contadores',
  'contabilidade',
  'cartórios',
  'despachantes',
  'consultórios',
  'clínicas',
];

const prisma = new PrismaClient();

async function upsertPlatformAccount() {
  const existing = await prisma.whatsappAccount.findFirst({
    where: {
      tenantId: null,
      provider: WhatsappProvider.CLOUD_API,
      phoneNumberId: PLATFORM_PHONE_NUMBER_ID,
    },
  });

  if (existing) {
    const updated = await prisma.whatsappAccount.update({
      where: { id: existing.id },
      data: {
        tokenEnvKey: 'WHATSAPP_TOKEN',
        enabled: true,
      },
    });
    console.log(`[seed-outreach] Platform WhatsappAccount updated id=${updated.id}`);
    return updated;
  }

  const created = await prisma.whatsappAccount.create({
    data: {
      provider: WhatsappProvider.CLOUD_API,
      phoneNumberId: PLATFORM_PHONE_NUMBER_ID,
      tokenEnvKey: 'WHATSAPP_TOKEN',
      tenantId: null,
      enabled: true,
    },
  });
  console.log(`[seed-outreach] Platform WhatsappAccount created id=${created.id}`);
  return created;
}

async function resolveOperationalTenantId(): Promise<number> {
  const fromEnv = process.env.TENANT_ID;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `TENANT_ID inválido: "${fromEnv}". Informe um inteiro positivo.`,
      );
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: parsed } });
    if (!tenant) {
      throw new Error(
        `Tenant id=${parsed} (TENANT_ID) não encontrado. Cadastre o tenant ou ajuste TENANT_ID.`,
      );
    }
    return tenant.id;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: DEFAULT_OPERATIONAL_TENANT_ID },
  });
  if (!tenant) {
    throw new Error(
      `Tenant operacional padrão id=${DEFAULT_OPERATIONAL_TENANT_ID} não existe neste ambiente. ` +
        `Passe TENANT_ID=<id> ao executar o seed (ex.: TENANT_ID=4 npx ts-node prisma/seed-outreach.ts).`,
    );
  }
  return tenant.id;
}

async function upsertOutreachConfig(tenantId: number) {
  const config = await prisma.tenantOutreachConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      enabled: true,
      costPerLead: 0.35,
      cashbackOnReply: 0,
      outreachTemplateName: 'test_gladson',
      notifyTenantTemplateName: 'lembrete_entrar_contato_interessado',
      schedule: SCHEDULE,
      categories: CATEGORIES,
      leadsPerRun: 5,
      sendIntervalSeconds: 5,
      headerImageUrl: null,
      outreachContactText: 'Gladson Teixeira (contador em Pindamonhagaba)',
    },
    update: {
      enabled: true,
      costPerLead: 0.35,
      cashbackOnReply: 0,
      outreachTemplateName: 'test_gladson',
      notifyTenantTemplateName: 'lembrete_entrar_contato_interessado',
      schedule: SCHEDULE,
      categories: CATEGORIES,
    },
  });
  console.log(
    `[seed-outreach] TenantOutreachConfig upserted id=${config.id} tenantId=${tenantId}`,
  );
  return config;
}

async function main() {
  const account = await upsertPlatformAccount();
  const tenantId = await resolveOperationalTenantId();
  const config = await upsertOutreachConfig(tenantId);

  console.log('[seed-outreach] Done.', {
    platformAccountId: account.id,
    phoneNumberId: account.phoneNumberId,
    outreachConfigId: config.id,
    tenantId: config.tenantId,
  });
}

main()
  .catch((err) => {
    console.error('[seed-outreach] Failed:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
