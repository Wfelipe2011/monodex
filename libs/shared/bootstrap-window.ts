export const BOOTSTRAP_EDIT_WINDOW_MS = 30 * 60 * 1000;

export function isWithinBootstrapWindow(
  createdAt: Date,
  nowMs: number = Date.now(),
): boolean {
  return nowMs - createdAt.getTime() < BOOTSTRAP_EDIT_WINDOW_MS;
}

export function canSuperAdminWriteAdminFields(args: {
  exists: boolean;
  createdAt?: Date | null;
}): boolean {
  if (!args.exists) {
    return true;
  }
  if (!args.createdAt) {
    return false;
  }
  return isWithinBootstrapWindow(args.createdAt);
}
