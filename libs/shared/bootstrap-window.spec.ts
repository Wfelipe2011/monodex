import { ForbiddenException } from '@nestjs/common';
import { Roles } from '@prisma/client';
import { assertSuperAdminTenantWrite } from '../guard/bootstrap-write';
import {
  BOOTSTRAP_EDIT_WINDOW_MS,
  canSuperAdminWriteAdminFields,
  isWithinBootstrapWindow,
} from './bootstrap-window';

const createdAt = new Date('2026-08-18T12:00:00.000Z');
const createdAtMs = createdAt.getTime();

describe('isWithinBootstrapWindow', () => {
  it('29 min 59 s → true', () => {
    expect(
      isWithinBootstrapWindow(createdAt, createdAtMs + 29 * 60 * 1000 + 59 * 1000),
    ).toBe(true);
  });

  it('30 min → false', () => {
    expect(
      isWithinBootstrapWindow(createdAt, createdAtMs + BOOTSTRAP_EDIT_WINDOW_MS),
    ).toBe(false);
  });
});

describe('canSuperAdminWriteAdminFields', () => {
  it('recurso inexistente → create permitido', () => {
    expect(canSuperAdminWriteAdminFields({ exists: false })).toBe(true);
    expect(
      canSuperAdminWriteAdminFields({ exists: false, createdAt: null }),
    ).toBe(true);
  });

  it('recurso existente dentro da janela → permitido', () => {
    jest.spyOn(Date, 'now').mockReturnValue(createdAtMs + 10 * 60 * 1000);
    expect(
      canSuperAdminWriteAdminFields({ exists: true, createdAt }),
    ).toBe(true);
    jest.restoreAllMocks();
  });

  it('recurso existente após 30 min → recusado', () => {
    jest.spyOn(Date, 'now').mockReturnValue(createdAtMs + BOOTSTRAP_EDIT_WINDOW_MS);
    expect(
      canSuperAdminWriteAdminFields({ exists: true, createdAt }),
    ).toBe(false);
    jest.restoreAllMocks();
  });
});

describe('assertSuperAdminTenantWrite', () => {
  const outsideWindow = new Date(createdAtMs - BOOTSTRAP_EDIT_WINDOW_MS - 1000);

  it('lança 403 fora da janela para campos Admin', () => {
    expect(() =>
      assertSuperAdminTenantWrite({
        roles: [Roles.SUPER_ADMIN],
        resourceCreatedAt: outsideWindow,
        isPlatformField: false,
      }),
    ).toThrow(ForbiddenException);

    try {
      assertSuperAdminTenantWrite({
        roles: [Roles.SUPER_ADMIN],
        resourceCreatedAt: outsideWindow,
        isPlatformField: false,
      });
      fail('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getStatus()).toBe(403);
    }
  });

  it('não lança para costPerLead', () => {
    expect(() =>
      assertSuperAdminTenantWrite({
        roles: [Roles.SUPER_ADMIN],
        resourceCreatedAt: outsideWindow,
        isPlatformField: true,
      }),
    ).not.toThrow();
  });

  it('permite create quando resourceCreatedAt é null', () => {
    expect(() =>
      assertSuperAdminTenantWrite({
        roles: [Roles.SUPER_ADMIN],
        resourceCreatedAt: null,
        isPlatformField: false,
      }),
    ).not.toThrow();
  });
});
