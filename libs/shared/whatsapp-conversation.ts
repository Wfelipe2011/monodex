import { normalizeListPhone } from './list-campaign-helpers';

export type WebhookContact = {
  wa_id?: string;
  profile?: { name?: string };
};

function nonEmptyTrimmed(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Dedicated platform account: `isDefault === false` (shared default is not dedicated). */
export function isDedicatedPlatformAccount(account: {
  isDefault: boolean;
}): boolean {
  return account.isDefault === false;
}

/** Match webhook `contacts[].wa_id` to `from` after `normalizeListPhone`; return trimmed `profile.name` or null. */
export function matchContactProfileName(
  contacts: Array<WebhookContact> | undefined,
  fromPhone: string,
): string | null {
  if (!contacts?.length) {
    return null;
  }
  const fromNormalized = normalizeListPhone(fromPhone);
  if (!fromNormalized) {
    return null;
  }
  for (const contact of contacts) {
    if (typeof contact.wa_id !== 'string') {
      continue;
    }
    if (normalizeListPhone(contact.wa_id) !== fromNormalized) {
      continue;
    }
    return nonEmptyTrimmed(contact.profile?.name);
  }
  return null;
}

export function resolveConversationDisplayName(input: {
  profileName: string | null;
  phone: string;
  existingDisplayName?: string | null;
  isNewThread: boolean;
}): string {
  const profileName = nonEmptyTrimmed(input.profileName);
  if (profileName) {
    return profileName;
  }
  if (input.isNewThread) {
    return input.phone;
  }
  return nonEmptyTrimmed(input.existingDisplayName) ?? input.phone;
}
