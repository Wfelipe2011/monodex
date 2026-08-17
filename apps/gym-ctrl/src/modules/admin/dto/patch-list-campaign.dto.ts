import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ButtonActionDto,
  NotifySlotBindingsDto,
  SendSlotBindingsDto,
} from './upsert-list-campaign.dto';

/** PATCH: parcial — só campos enviados. */
export class PatchListCampaignDto {
  @ApiPropertyOptional({ example: 'Campanha A' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  templateId?: number;

  @ApiPropertyOptional({ type: SendSlotBindingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SendSlotBindingsDto)
  slotBindings?: SendSlotBindingsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  notifyTemplateId?: number | null;

  @ApiPropertyOptional({ type: NotifySlotBindingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotifySlotBindingsDto)
  notifySlotBindings?: NotifySlotBindingsDto;

  @ApiPropertyOptional({ type: [ButtonActionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ButtonActionDto)
  buttonActions?: ButtonActionDto[];

  @ApiPropertyOptional({
    description: 'Mapa dia-da-semana → horas UTC',
    example: { '2': [18], '4': [13] },
  })
  @IsOptional()
  @IsObject()
  schedule?: Record<string, number[]>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sendsPerRun?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sendIntervalSeconds?: number;
}
