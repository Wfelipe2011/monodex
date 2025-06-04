import { Injectable } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    console.log('here: ', process.env.NOTIFLY_JWT_SECRET)
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.NOTIFLY_JWT_SECRET,
    });
  }

  async validate(payload: IJwtPayload) {
    return payload;
  }
}
