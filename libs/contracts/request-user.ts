import { Request } from 'express';
import { UserToken } from './user-token';

export interface RequestUser extends Request {
  user: UserToken;
}


