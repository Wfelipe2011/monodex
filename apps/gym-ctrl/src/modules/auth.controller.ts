import { Body, Controller, HttpCode, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LoginInput, LoginOutput } from '../dtos/login.dto';
import { ChangePasswordDto, ChangePasswordOutput } from '../dtos/change-password.dto';
import { Public } from '@core/decorators/public.decorator';
import { RequestUser } from '@core/contracts/request-user';
import {
  ApiDocErrors,
  ApiPublicRouteErrors,
  ApiRouteErrors,
} from '../swagger/api-route-errors.decorator';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(readonly authService: AuthService) { }

  @Public()
  @ApiOperation({ summary: 'Autenticação de usuário' })
  @ApiOkResponse({
    description: 'Usuário logado com sucesso',
    type: LoginOutput,
  })
  @ApiPublicRouteErrors({ badRequest: 'Faltando dados' })
  @ApiDocErrors.unauthorized('Não autorizado')
  @Post('login')
  async login(@Body() loginDto: LoginInput) {
    return this.authService.login(loginDto.email.toLocaleLowerCase(), loginDto.password);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Alterar a própria senha informando a senha atual' })
  @ApiOkResponse({ description: 'Senha alterada', type: ChangePasswordOutput })
  @ApiRouteErrors({
    badRequest: 'Validação do body falhou (senhas, min length)',
  })
  @ApiDocErrors.unauthorized(
    'JWT ausente/inválido, usuário inexistente ou senha atual incorreta (hash não é alterado)',
  )
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: RequestUser) {
    const userId = req.user.userId ?? req.user.id;
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }
}
