/**
 * Idempotent seed: platform Tenant ("Platform") + SUPER_ADMIN user.
 *
 * Credentials (required when NODE_ENV !== 'development'):
 * - PLATFORM_ADMIN_EMAIL
 * - PLATFORM_ADMIN_PASSWORD
 *
 * Development defaults (only when NODE_ENV=development and env unset):
 * - email: platform-admin@local.dev
 * - password: platform-admin-dev
 *
 * Optional:
 * - PLATFORM_ADMIN_USERNAME (default: local-part of email, or "platform-admin")
 * - PLATFORM_ADMIN_NAME (default: "Platform Admin")
 *
 * Usage: npx ts-node prisma/seed-platform-admin.ts
 */
import { PrismaClient, Roles } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const PLATFORM_TENANT_NAME = 'Platform';
const DEV_DEFAULT_EMAIL = 'platform-admin@local.dev';
const DEV_DEFAULT_PASSWORD = 'platform-admin-dev';

const prisma = new PrismaClient();

function resolveCredentials(): { email: string; password: string } {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const isDev = process.env.NODE_ENV === 'development';

  if (email && password) {
    return { email, password };
  }

  if (isDev) {
    console.log(
      '[seed-platform-admin] Using development defaults for missing PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD',
    );
    return {
      email: email ?? DEV_DEFAULT_EMAIL,
      password: password ?? DEV_DEFAULT_PASSWORD,
    };
  }

  throw new Error(
    'PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD are required when NODE_ENV is not "development".',
  );
}

function deriveUsername(email: string): string {
  if (process.env.PLATFORM_ADMIN_USERNAME) {
    return process.env.PLATFORM_ADMIN_USERNAME;
  }
  const local = email.split('@')[0]?.trim();
  return local && local.length > 0 ? local : 'platform-admin';
}

async function upsertPlatformTenant() {
  const existing = await prisma.tenant.findFirst({
    where: { name: PLATFORM_TENANT_NAME },
  });

  if (existing) {
    const updated = await prisma.tenant.update({
      where: { id: existing.id },
      data: { active: true },
    });
    console.log(
      `[seed-platform-admin] Platform tenant exists id=${updated.id} active=${updated.active}`,
    );
    return updated;
  }

  const created = await prisma.tenant.create({
    data: {
      name: PLATFORM_TENANT_NAME,
      active: true,
      phone: null,
      // apiAccessEnabled default false — canal on-demand fechado até Super Admin ligar
    },
  });
  console.log(
    `[seed-platform-admin] Platform tenant created id=${created.id} apiAccessEnabled=false (schema default)`,
  );
  return created;
}

async function ensurePlatformAdmin(tenantId: number, email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const hasSuperAdmin = existing.roles.includes(Roles.SUPER_ADMIN);
    console.log(
      `[seed-platform-admin] User already exists id=${existing.id} email=${email} ` +
        `hasSUPER_ADMIN=${hasSuperAdmin} (password not reset)`,
    );
    return { user: existing, created: false };
  }

  const hashed = await bcrypt.hash(password, 10);
  const username = deriveUsername(email);
  const name = process.env.PLATFORM_ADMIN_NAME ?? 'Platform Admin';

  const created = await prisma.user.create({
    data: {
      name,
      username,
      email,
      password: hashed,
      roles: [Roles.SUPER_ADMIN],
      tenantId,
    },
  });

  console.log(
    `[seed-platform-admin] SUPER_ADMIN user created id=${created.id} email=${email} username=${username}`,
  );
  return { user: created, created: true };
}

async function main() {
  const { email, password } = resolveCredentials();
  const tenant = await upsertPlatformTenant();
  const { user, created } = await ensurePlatformAdmin(tenant.id, email, password);

  console.log('[seed-platform-admin] Done.', {
    tenantId: tenant.id,
    tenantName: tenant.name,
    userId: user.id,
    email: user.email,
    roles: user.roles,
    created,
  });
}

main()
  .catch((err) => {
    console.error('[seed-platform-admin] Failed:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
