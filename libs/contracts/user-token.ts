import { Roles } from "@prisma/client";

export class UserToken {
  id: number;
  userId: number;
  userName: string;
  tenantId: number;
  roles: Roles[];
  constructor(id: number, userId: number, userName: string, tenancy: number, roles: Roles[] = []) {
    this.id = id;
    this.userId = userId;
    this.tenantId = tenancy;
    this.roles = roles;
  }
}
