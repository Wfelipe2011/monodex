import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ListCampaignButtonAction } from '@prisma/client';
import { SlotBindingEntryDto } from './upsert-outreach-config.dto';

export class SendSlotBindingsDto {
  @ApiProperty({
    description: 'Bindings do template de disparo, keyed por slot',
    example: {
      'body.1': { type: 'literal', value: 'Olá' },
      'body.customer_name': { type: 'recipient.name' },
    },
  })
  @IsObject()
  send: Record<string, SlotBindingEntryDto>;
}

export class NotifySlotBindingsDto {
  @ApiProperty({
    description: 'Bindings do template de notify, keyed por slot',
    example: {
      'body.customer_name': { type: 'recipient.name' },
    },
  })
  @IsObject()
  notify: Record<string, SlotBindingEntryDto>;
}

export class ButtonActionDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  buttonIndex: number;

  @ApiProperty({ example: 'Tenho Interesse!' })
  @IsString()
  label: string;

  @ApiProperty({ enum: ListCampaignButtonAction, example: 'NOTIFY' })
  @IsString()
  @IsIn(Object.values(ListCampaignButtonAction))
  action: ListCampaignButtonAction;
}

/**
 * POST/PUT: corpo completo da campanha.
 *
 * @example
 * {
 *   "name": "Campanha A",
 *   "enabled": false,
 *   "templateId": 5,
 *   "slotBindings": {
 *     "send": {
 *       "body.1": { "type": "literal", "value": "Olá!" },
 *       "body.customer_name": { "type": "recipient.name" }
 *     }
 *   },
 *   "notifyTemplateId": 6,
 *   "notifySlotBindings": {
 *     "notify": {
 *       "body.customer_name": { "type": "recipient.name" },
 *       "body.customer_phone": { "type": "recipient.phone" }
 *     }
 *   },
 *   "buttonActions": [
 *     { "buttonIndex": 0, "label": "Tenho Interesse!", "action": "NOTIFY" },
 *     { "buttonIndex": 1, "label": "Agora não", "action": "NOOP" }
 *   ],
 *   "schedule": { "2": [18], "4": [13] },
 *   "sendsPerRun": 5,
 *   "sendIntervalSeconds": 5
 * }
 */
export class UpsertListCampaignDto {
  @ApiProperty({ example: 'Campanha A' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Habilitar execução no cron (validação estrita quando true)',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'FK do template de disparo no catálogo' })
  @IsInt()
  @Min(1)
  templateId: number;

  @ApiProperty({ type: SendSlotBindingsDto })
  @ValidateNested()
  @Type(() => SendSlotBindingsDto)
  slotBindings: SendSlotBindingsDto;

  @ApiPropertyOptional({ description: 'FK do template de notify (obrigatório se NOTIFY)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  notifyTemplateId?: number;

  @ApiPropertyOptional({ type: NotifySlotBindingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotifySlotBindingsDto)
  notifySlotBindings?: NotifySlotBindingsDto;

  @ApiProperty({ type: [ButtonActionDto] })
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => ButtonActionDto)
  buttonActions: ButtonActionDto[];

  @ApiProperty({
    description: 'Mapa dia-da-semana → horas UTC',
    example: { '2': [18], '4': [13] },
  })
  @IsObject()
  schedule: Record<string, number[]>;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sendsPerRun?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sendIntervalSeconds?: number;
}
