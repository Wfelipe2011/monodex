import { Roles } from "@prisma/client";

export class UserToken {
  id: number;
  userId: number;
  userName: string;
  tenantId: number;
  roles: Roles[];
  authKind?: 'jwt' | 'api_key';
  apiKeyId?: number;
  constructor(id: number, userId: number, userName: string, tenancy: number, roles: Roles[] = []) {
    this.id = id;
    this.userId = userId;
    this.userName = userName;
    this.tenantId = tenancy;
    this.roles = roles;
  }
}
