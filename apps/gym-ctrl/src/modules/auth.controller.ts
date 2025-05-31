import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginInput, LoginOutput } from '../dtos/login.dto';
import { Public } from '@core/decorators/public.decorator';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(readonly authService: AuthService) { }

  @Public()
  @ApiOperation({ summary: 'Autenticação de usuário' })
  @ApiResponse({ status: 200, description: 'Usuário logado com sucesso', type: LoginOutput })
  @Post('login')
  async login(@Body() loginDto: LoginInput) {
    return this.authService.login(loginDto.email.toLocaleLowerCase(), loginDto.password);
  }
}
