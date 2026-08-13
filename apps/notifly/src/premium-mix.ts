export type MixLeadFields = {
  phone: string;
  rating: number | null;
  reviews: number | null;
  categories: string[];
  category: string;
};

export function coalesceReviews(reviews: number | null): number {
  return reviews > 0 ? reviews : 1;
}

export function premiumTier(rating: number | null): 4 | 5 | null {
  if (rating == null || rating < 4) {
    return null;
  }
  const rounded = Math.round(rating);
  if (rounded === 4 || rounded === 5) {
    return rounded;
  }
  return null;
}

export function leadCategoryList(lead: {
  categories: string[];
  category: string;
}): string[] {
  return lead.categories.length > 0 ? lead.categories : [lead.category];
}

export function leadMatchesTenantCategories(
  lead: { categories: string[]; category: string },
  tenantCategories: string[],
): boolean {
  if (tenantCategories.length === 0) {
    return false;
  }
  return leadCategoryList(lead).some((cat) => tenantCategories.includes(cat));
}

export function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function uniqueByPhone<T extends { phone: string }>(leads: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const lead of shuffle(leads)) {
    if (seen.has(lead.phone)) {
      continue;
    }
    seen.add(lead.phone);
    unique.push(lead);
  }
  return unique;
}

export function excludeUsedPhones<T extends { phone: string }>(
  leads: T[],
  usedPhones: Set<string>,
): T[] {
  return leads.filter((lead) => !usedPhones.has(lead.phone));
}

export function buildCategoryAverages(
  leads: Array<{ categories: string[]; category: string; reviews: number | null }>,
  tenantCategories: string[],
): Map<string, number> {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const cat of tenantCategories) {
    acc.set(cat, { sum: 0, count: 0 });
  }
  for (const lead of leads) {
    const cats = leadCategoryList(lead);
    const reviewsStar = coalesceReviews(lead.reviews);
    for (const cat of tenantCategories) {
      if (!cats.includes(cat)) {
        continue;
      }
      const bucket = acc.get(cat);
      if (!bucket) {
        continue;
      }
      bucket.sum += reviewsStar;
      bucket.count += 1;
    }
  }
  const averages = new Map<string, number>();
  for (const [cat, bucket] of acc) {
    if (bucket.count > 0) {
      averages.set(cat, bucket.sum / bucket.count);
    }
  }
  return averages;
}

export function isPremium(
  lead: MixLeadFields,
  avgByCategory: Map<string, number>,
  tenantCategories: string[],
): boolean {
  const tier = premiumTier(lead.rating);
  if (tier === null) {
    return false;
  }
  const reviewsStar = coalesceReviews(lead.reviews);
  const threshold = tier === 5 ? 0.1 : 0.05;
  const intersect = leadCategoryList(lead).filter((cat) =>
    tenantCategories.includes(cat),
  );
  return intersect.some((cat) => {
    const avg = avgByCategory.get(cat);
    if (avg == null) {
      return false;
    }
    return reviewsStar >= threshold * avg;
  });
}

export function computeY(P: number, R: number, X: number): number {
  if (P === 0 || X <= 0) {
    return 0;
  }
  let Y = Math.min(P, Math.round((X * P) / (P + R)));
  if (R > 0) {
    Y = Math.min(Y, X - 1);
  }
  return Math.max(0, Y);
}

export function selectStratifiedBatch<T>(
  premium: T[],
  regular: T[],
  X: number,
  Y: number,
): T[] {
  const takenPremium = shuffle(premium).slice(0, Math.max(0, Y));
  const takenRegular = shuffle(regular).slice(0, Math.max(0, X - Y));
  return shuffle([...takenPremium, ...takenRegular]);
}
