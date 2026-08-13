/**
 * Idempotent seed: one enabled ScrapeTarget for Pindamonhangaba + Construtoras.
 *
 * Usage: npx ts-node prisma/seed-scrape-targets.ts
 */
import { PrismaClient } from '@prisma/client';

const CITY_NAME = 'Pindamonhangaba';
const CATEGORY = 'Construtoras';

const prisma = new PrismaClient();

async function ensureCity() {
  const existing = await prisma.city.findFirst({ where: { name: CITY_NAME } });
  if (existing) {
    console.log(`[seed-scrape-targets] City exists id=${existing.id} name=${existing.name}`);
    return existing;
  }

  const created = await prisma.city.create({ data: { name: CITY_NAME } });
  console.log(`[seed-scrape-targets] City created id=${created.id} name=${created.name}`);
  return created;
}

async function upsertTarget(cityId: number) {
  const target = await prisma.scrapeTarget.upsert({
    where: { cityId_category: { cityId, category: CATEGORY } },
    create: {
      cityId,
      category: CATEGORY,
      enabled: true,
    },
    update: {
      enabled: true,
    },
  });

  console.log(
    `[seed-scrape-targets] ScrapeTarget id=${target.id} cityId=${target.cityId} ` +
      `category=${target.category} enabled=${target.enabled}`,
  );
  return target;
}

async function main() {
  const city = await ensureCity();
  const target = await upsertTarget(city.id);

  console.log('[seed-scrape-targets] Done.', {
    cityId: city.id,
    cityName: city.name,
    targetId: target.id,
    category: target.category,
    enabled: target.enabled,
  });
}

main()
  .catch((err) => {
    console.error('[seed-scrape-targets] Failed:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
