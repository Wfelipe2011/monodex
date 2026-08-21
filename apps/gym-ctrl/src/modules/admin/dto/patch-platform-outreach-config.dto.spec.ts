import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PatchPlatformOutreachConfigDto } from './patch-platform-outreach-config.dto';

describe('PatchPlatformOutreachConfigDto — coinDebitOnStatus', () => {
  async function validateDto(plain: Record<string, unknown>) {
    const dto = plainToInstance(PatchPlatformOutreachConfigDto, plain);
    return validate(dto);
  }

  it('aceita sent | delivered | read', async () => {
    for (const value of ['sent', 'delivered', 'read'] as const) {
      const errors = await validateDto({ coinDebitOnStatus: value });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejeita failed e valores desconhecidos', async () => {
    for (const value of ['failed', 'unknown', '']) {
      const errors = await validateDto({ coinDebitOnStatus: value });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'coinDebitOnStatus')).toBe(true);
    }
  });
});
