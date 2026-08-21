import { SetMetadata } from '@nestjs/common';

export const API_KEY_ALLOWLIST_KEY = 'apiKeyAllowlist';
export const ApiKeyAllowlist = () => SetMetadata(API_KEY_ALLOWLIST_KEY, true);
