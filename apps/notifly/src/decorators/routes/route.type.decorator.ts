import { CustomDecorator, SetMetadata } from '@nestjs/common';

export enum RouteTypesEnum {
  PUBLIC = 'PUBLIC',
}

export type RouteTypesKeys = keyof typeof RouteTypesEnum;

export const RouteType = (route: RouteTypesKeys): CustomDecorator =>
  SetMetadata(route, true);
