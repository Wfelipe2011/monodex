import { z } from 'zod';

export interface NewMessage {
    phoneNumber: string;
    message: string
}

const triggers = ['CONVERSATION_MESSAGE'] as const
export const webhookSchema = z.object({
    name: z.string(),
    target: z.string(),
    trigger: z.enum(triggers).optional(),
    enabled: z.boolean().optional(),
    filter: z.object({
        contacts: z.array(z.string()).optional()
    }).optional()
})
export type NewWebhook = z.infer<typeof webhookSchema>