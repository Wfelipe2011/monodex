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
    const phone = repliedLeads.map((lead: any) => lead.phone)

    const leads = await prisma.lead.findMany({
        where: {
            phone: {
                in: phone,
            }
        }
    });

})();