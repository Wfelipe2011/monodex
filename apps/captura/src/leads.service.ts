import { PrismaService } from '@core/infra/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Temperature } from '@prisma/client';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

@Injectable()
export class LeadsService {
    logger = new Logger(LeadsService.name);
    constructor(private prisma: PrismaService) { }

    @Cron('0 12,13,14,17,18 * * 1,2,4,5')
    async contactLeads() {
        this.logger.log('[contactLeads] Buscando leads para contato...');
        const leadsTenant = await this.prisma.tenantLead.findMany({
            where: {
                tenantId: 4,
            },
            select: {
                leadId: true,
                contacted: true,
            }
        });

        const leads = await this.prisma.lead.findMany({
            where: {
                id: {
                    notIn: leadsTenant.map(lt => lt.leadId),
                },
                deletedAt: null,
                category: {
                    in: [
                        // 'Construtoras',
                        'Escritórios de advocacia',
                        // 'Clínicas médicas',
                        // 'Clínicas odontológicas',
                        // 'Consultórios',
                        // 'Estéticas',
                        // 'Consutorias',
                        // 'Cursos de inglês',
                        // 'Agência Marketing Digital',
                        // 'Web Design',
                    ]
                },
                phone: {
                    not: {
                        contains: "153",
                    }
                },
                OR: [
                    { website: "" },
                    { website: { contains: "facebo", mode: "insensitive" } },
                    { website: { contains: "instagra", mode: "insensitive" } },
                    { website: { contains: "sites", mode: "insensitive" } },
                    { website: { contains: "link", mode: "insensitive" } },
                    { website: { contains: "w.app", mode: "insensitive" } },
                    { website: { contains: "wixsite", mode: "insensitive" } },
                    { website: { contains: "wa.me", mode: "insensitive" } },
                    { website: { contains: "whatsapp", mode: "insensitive" } },
                ]
            },
        });
        this.logger.log(`[contactLeads] Encontrados ${leads.length} leads para contato`);
        const shuffledLeads = leads.sort(() => Math.random() - 0.5)
        const sliceRandom = Math.floor(Math.random() * (10 - 5 + 1)) + 5;
        const leadsToContact = shuffledLeads.slice(0, sliceRandom);
        this.logger.log('[contactLeads] Leads selecionados para contato: ' + JSON.stringify(leadsToContact.map(l => ({ id: l.id, phone: l.phone, website: l.website }))));

        for (const lead of leadsToContact) {
            try {
                const greeting = `Olá, tudo bem?`;
                await this.sendMessage("55" + lead.phone, greeting);
                const sleepTime = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
                await sleep(sleepTime);
                const messageText = message(lead.category);
                this.logger.log(`[contactLeads] Enviando mensagem para ${lead.phone}: ${messageText}`);
                await this.sendMessage("55" + lead.phone, messageText);
                await this.prisma.$transaction(async (tsx) => {
                    const tenantLeadId = await tsx.tenantLead.create({
                        data: {
                            leadId: lead.id,
                            tenantId: 4,
                            contacted: true,
                        }
                    });
                    this.logger.log(`[contactLeads] Lead ${lead.id} marcado como contatado no tenant`);
                    await tsx.userLead.create({
                        data: {
                            tenantId: 4,
                            userId: 4,
                            tenantLeadId: tenantLeadId.id,
                        }
                    });
                    this.logger.log(`[contactLeads] UserLead criado para o lead ${lead.id}`);
                    await tsx.coin.update({
                        where: {
                            userId_tenantId: {
                                tenantId: 4,
                                userId: 4,
                            }
                        },
                        data: {
                            balance: {
                                decrement: 1,
                            }
                        }
                    });
                    this.logger.log(`[contactLeads] Saldo de moedas decrementado para userId=4, tenantId=4`);
                    await tsx.coinTransaction.create({
                        data: {
                            amount: -1,
                            type: 'DEBITO',
                            userId: 4,
                            tenantId: 4,
                            leadId: lead.id,
                        }
                    });
                })
                this.logger.log(`[contactLeads] Lead marcado como contatado: id=${lead.id}, phone=${lead.phone}`);
            } catch (error) {
                this.logger.error(`[contactLeads] Erro ao processar lead ${lead.id}: ${error}`);
                continue;
            }
            const randomTime = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
            await sleep(randomTime);
        }
    }

    async responseLeads(body: { phoneNumber: string, textMessage: string }) {
        console.log('[responseLeads] Received response:', body);
        const { phoneNumber, textMessage } = body;
        const lead = await this.prisma.lead.findFirst({
            where: {
                phone: {
                    contains: phoneNumber.replace(/[^0-9]/g, '').replace('55', ''),
                    mode: 'insensitive',
                }
            },
        });
        if (!lead) {
            console.log(`[responseLeads] Lead not found for phone number: ${phoneNumber}`);
            return;
        }
        await this.prisma.tenantLead.updateMany({
            where: {
                leadId: lead.id,
                tenantId: 4,
            },
            data: {
                contacted: true,
                replied: true,
            }
        });
        await this.prisma.lead.update({
            where: {
                id: lead.id,
            },
            data: {
                temperature: Temperature.MORNO,
            }
        });
        console.log(`[responseLeads] Marked lead as contacted and replied: id=${lead.id}, phone=${lead.phone}`);
    }

    async auth(): Promise<{ token: string }> {
        console.log('[auth] Authenticating...');
        const res = await fetch('https://baileys.wfelipe.com.br/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'insomnia/11.1.0',
            },
            body: JSON.stringify({
                username: process.env.WHATSAPP_USERNAME,
                password: process.env.WHATSAPP_PASSWORD,
            }),
        });
        const data = await res.json();
        console.log('[auth] Authenticated:', data);
        return data;
    }

    async sendMessage(phoneNumber: string, message: string) {
        console.log(`[sendMessage] Sending message to ${phoneNumber}`);
        const auth = await this.auth();
        const res = await fetch('https://baileys.wfelipe.com.br/whatsapp/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`,
            },
            body: JSON.stringify({
                phoneNumber,
                message,
            }),
        });
        const data = await res.json();
        console.log(`[sendMessage] Message sent to ${phoneNumber}:`, data);
        return data;
    }

    async shuffleLeads(leads: any[]) {
        console.log(`[shuffleLeads] Shuffling ${leads.length} leads`);
        const shuffledLeads = leads.sort(() => Math.random() - 0.5);
        return shuffledLeads;
    }
}

function message(category: string): string {
    console.log(`[message] Generating message for category: ${category}`);
    const messages = {
        ["Clínicas odontológicas"]: `Eu sou a Giulia e trabalho com *criação e reformulação de sites profissionais*. 

Vi que talvez sua clínica odontológica esteja em busca de um *site novo* ou de uma *atualização no atual* — isso pode fazer *muita diferença* na hora de transmitir confiança e captar novos pacientes.

Se quiser, podemos *conversar melhor* e ver juntos o que faria mais sentido para a sua clínica.`,

        ["Clínicas médicas"]: `Me chamo Giulia e sou especialista em *criação e renovação de sites*. 

Pensei que talvez você esteja considerando *refazer o site* da sua clínica ou até mesmo *criar um do zero* — o que pode ajudar bastante na *divulgação* e na *atração de novos clientes*.

Se quiser podemos *conversar melhor* e ver juntos o que faria mais sentido para você, *estou à disposição.*`,
        ["Consultórios"]: `Me chamo Giulia e sou especialista em *criação e renovação de sites*. 

Pensei que talvez você esteja considerando *refazer o site* da sua clínica ou até mesmo *criar um do zero* — o que pode ajudar bastante na *divulgação* e na *atração de novos clientes*.

Se quiser podemos *conversar melhor* e ver juntos o que faria mais sentido para você, *estou à disposição.*`,

        ["Petshop"]: `Me chamo Giulia e sou especialista em *desenvolvimento de sites*. 

Estava pensando que talvez você esteja querendo *criar um site novo* ou *modernizar o atual* do seu petshop — algo que ajude a *destacar seus serviços* e *alcançar mais clientes online*.

Se fizer sentido pra você, posso te *explicar melhor* como funciona meu trabalho.`,

        ["Construtoras"]: `Eu sou a Giulia, e trabalho com *criação e renovação de sites profissionais*. 

Talvez seja um bom momento para *criar um site novo* ou *atualizar o atual* — uma ótima forma de *valorizar seus projetos* e *atrair novos clientes*.

Se quiser, podemos *bater um papo* para eu entender melhor o que você precisa.`,

        ["Advocacia"]: `Me chamo Giulia e sou especialista em *criação e reformulação de sites profissionais*. 

Notei que seu escritório pode estar pensando em *criar um novo site* ou *dar uma repaginada no atual* — isso ajuda muito a *transmitir credibilidade* e *atrair novos clientes*.

Se tiver interesse, podemos *conversar melhor* sobre como posso te ajudar com isso.`,
        ["Cursos de inglês"]: `Me chamo Giulia e sou especialista em *conteúdos digitais* e *criação de sites*.

Notei que muitos cursos ainda não aproveitam todo o potencial de dois pontos importantes:
– Um *site completo*, moderno e funcional, que transmita profissionalismo e facilite o contato com alunos.
– E *materiais digitais personalizados*, como *apostilas em PDF*, *apresentações*, *exercícios interativos* e outros recursos que valorizam a experiência do aluno.

Se você estiver pensando em melhorar algum desses pontos — ou os dois — posso te ajudar com soluções práticas e acessíveis.

Se fizer sentido pra você, *podemos conversar* melhor sobre como aplicar isso no seu curso.`
    }

    const defaultMessage = `Me chamo Giulia e sou especialista em *criação e reformulação de sites profissionais*. 

Vi que talvez você esteja pensando em *criar um site novo* ou *dar uma modernizada no atual* — e isso pode fazer *toda a diferença* na forma como seus clientes veem seu negócio.

Se quiser, podemos *conversar melhor* e ver como posso te ajudar com isso.`

    return messages[category] || defaultMessage
}
