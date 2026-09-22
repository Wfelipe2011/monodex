import { cityAllowed } from './send-policy';

export type EligibleOutreachCategoriesInput = {
  allowedCityIds: number[];
  deniedCityIds: number[];
  targets: Array<{ cityId: number; category: string; enabled: boolean }>;
};

/**
 * Distinct enabled target categories whose city passes the tenant send policy.
 * Includes all enabled global targets in allowed cities (not only tenant links).
 */
export function eligibleOutreachCategories(
  input: EligibleOutreachCategoriesInput,
): string[] {
  const { allowedCityIds, deniedCityIds, targets } = input;
  const categories = new Set<string>();

  for (const target of targets) {
    if (!target.enabled) {
      continue;
    }
    if (!cityAllowed(target.cityId, allowedCityIds, deniedCityIds)) {
      continue;
    }
    categories.add(target.category);
  }

  return [...categories].sort();
}
