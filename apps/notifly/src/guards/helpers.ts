import {
  RouteTypesEnum,
  RouteTypesKeys,
} from '../decorators/routes/route.type.decorator';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';

export const getRouteTypeFromMetadata = (
  reflector: Reflector,
  context: ExecutionContext,
) =>
  Object.keys(RouteTypesEnum).reduce(
    (routes, route) => ({
      ...routes,
      [route]: reflector.getAllAndOverride<boolean>(route, [
        context.getHandler(),
        context.getClass(),
      ]),
    }),
    {},
  ) as Record<RouteTypesKeys, boolean | undefined>;

export const IS_PUBLIC_KEY = 'isPublic';
export const Public =  () => SetMetadata(IS_PUBLIC_KEY, true);