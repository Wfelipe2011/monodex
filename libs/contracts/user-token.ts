import { Roles } from "@prisma/client";

export class UserToken {
  id: string;
  userId: number;
  tenantId: number;
  roles: Roles[];
  constructor(id: string, userId: number, tenancy: number, roles: Roles[] = []) {
    this.id = id;
    this.userId = userId;
    this.tenantId = tenancy;
    this.roles = roles;
  }
}
