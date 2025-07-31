import { CoinTransactionType, PrismaClient } from "@prisma/client";
import fs from 'fs';
const tenat = 4;
const userId = 4;

void (async () => {
    const prisma = new PrismaClient();

    const data = fs.readFileSync('leads.json', 'utf-8');
    const leadsData = JSON.parse(data);

    // filtrar todos com contacted true
    const contactedLeads = leadsData.Lead.filter((lead: any) => lead.contacted === true);
    const repliedLeads = contactedLeads.filter((lead: any) => lead.replied === true);
    console.log('contactedLeads', contactedLeads.length);
    console.log('repliedLeads', repliedLeads.length);
    const phone = contactedLeads.map((lead: any) => lead.phone)

    const leads = await prisma.lead.findMany({
        where: {
            phone: {
                in: phone,
            }
        }
    });
    console.log('leads', leads.length);

    for (const lead of leads) {
        await prisma.$transaction(async (tsx) => {
            await tsx.coinTransaction.create({
                data: {
                    amount: -1,
                    type: CoinTransactionType.DEBITO,
                    userId: 4,
                    tenantId: 4,
                    leadId: lead.id,
                }
            })
            console.log('Comprando lead', lead.id, lead.phone);
            await tsx.coin.update({
                where: {
                    userId_tenantId: {
                        tenantId: 4,
                        userId: 4,
                    }
                },
                data: {
                    balance: {
                        increment: -1,
                    }
                }
            });
            console.log('Saldo atualizado');
            const leadTenant = await tsx.tenantLead.create({
                data: {
                    leadId: lead.id,
                    tenantId: 4,
                    contacted: true,
                }
            });
            console.log('Lead comprado', leadTenant.id, leadTenant.leadId, leadTenant.tenantId);
            await tsx.userLead.create({
                data: {
                    tenantId: 4,
                    userId: 4,
                    tenantLeadId: leadTenant.id,
                }
            });
            console.log('UserLead criado', leadTenant.id, leadTenant.leadId, leadTenant.tenantId);
        })
    }
})();