import { createParamDecorator, ExecutionContext } from '@nestjs/common';

const getRequestUser = <T>() =>
  createParamDecorator(
    (key, context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();

      if (key) return request?.user[key];

      return request?.user;
    },
  );

export const CurrentPassport = getRequestUser<IJwtPayload>();
