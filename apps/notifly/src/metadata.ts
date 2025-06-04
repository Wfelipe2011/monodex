/* eslint-disable */
export default async () => {
    const t = {};
    return { "@nestjs/swagger": { "models": [], "controllers": [[import("./modules/whatsapp/whatsapp.controller"), { "WhatsappController": { "sendMessage": {}, "sessionInit": { type: Object }, "sessionLogout": {}, "contacts": {}, "webhook": {}, "getWebhook": {}, "getWebhookById": {}, "updateWebhook": {}, "deleteWebhook": {} } }]] } };
};