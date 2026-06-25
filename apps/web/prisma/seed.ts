import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@meucuidadoessencial.com.br";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const adminName = process.env.ADMIN_NAME ?? "Administrador";

  const passwordHash = await hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      active: true,
    },
  });

  console.log(`Admin criado: ${admin.email}`);

  const pipeline = await prisma.pipeline.upsert({
    where: { id: "default-pipeline" },
    update: {},
    create: {
      id: "default-pipeline",
      name: "Atendimento",
      createdBy: admin.id,
      stages: {
        createMany: {
          data: [
            { name: "Novo",               position: 1, color: "#3b82f6" },
            { name: "Em atendimento",     position: 2, color: "#eab308" },
            { name: "Aguardando cliente", position: 3, color: "#f97316" },
            { name: "Resolvido",          position: 4, color: "#22c55e" },
          ],
        },
      },
    },
  });

  console.log(`Pipeline criado: ${pipeline.name} com 4 estágios`);

  await seedAnalytics();
}

// ============================================================
// SEED DE DEMONSTRAÇÃO — métricas de campanhas e GA4 (Módulo 4)
// Dados fictícios para validar o dashboard sem credenciais reais.
// Idempotente: upsert pelas chaves únicas.
// ============================================================
async function seedAnalytics() {
  const DAYS = 30;
  const AOV = 180; // ticket médio fictício (R$) para derivar ROAS

  const campaigns: Array<{ platform: "meta" | "google"; id: string; name: string; baseImpr: number; ctr: number; cpmBase: number; convRate: number }> = [
    { platform: "meta",   id: "meta-001", name: "Remarketing - Estante",   baseImpr: 22000, ctr: 0.032, cpmBase: 28, convRate: 0.05 },
    { platform: "meta",   id: "meta-002", name: "Prospecção - Decoração",  baseImpr: 38000, ctr: 0.018, cpmBase: 22, convRate: 0.025 },
    { platform: "meta",   id: "meta-003", name: "Lookalike - Parede",      baseImpr: 15000, ctr: 0.026, cpmBase: 31, convRate: 0.04 },
    { platform: "google", id: "ggl-001",  name: "Search - Marca",          baseImpr: 9000,  ctr: 0.085, cpmBase: 18, convRate: 0.09 },
    { platform: "google", id: "ggl-002",  name: "Shopping - Produtos",     baseImpr: 26000, ctr: 0.021, cpmBase: 15, convRate: 0.035 },
  ];

  const ga4Sources: Array<{ source: string; medium: string; weight: number }> = [
    { source: "google", medium: "organic", weight: 0.45 },
    { source: "facebook", medium: "cpc", weight: 0.35 },
    { source: "(direct)", medium: "(none)", weight: 0.2 },
  ];

  // Variação suave por dia para parecer real.
  const wave = (i: number, amp: number) => 1 + amp * Math.sin(i / 3);

  let campaignRows = 0;
  let ga4Rows = 0;

  for (let d = DAYS - 1; d >= 0; d--) {
    const now = new Date();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d));

    for (const c of campaigns) {
      const factor = wave(DAYS - d, 0.25);
      const impressions = Math.round(c.baseImpr * factor);
      const clicks = Math.round(impressions * c.ctr * wave(d, 0.15));
      const reach = Math.round(impressions * 0.78);
      const cpm = c.cpmBase * wave(d, 0.1);
      const spend = (impressions / 1000) * cpm;
      const conversions = Math.round(clicks * c.convRate);
      const roas = spend > 0 ? (conversions * AOV) / spend : 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      await prisma.campaignMetric.upsert({
        where: { platform_campaignId_date: { platform: c.platform, campaignId: c.id, date: day } },
        update: {},
        create: {
          platform: c.platform,
          accountId: c.platform === "meta" ? "act_demo" : "ggl_demo",
          campaignId: c.id,
          campaignName: c.name,
          status: "ACTIVE",
          date: day,
          impressions,
          clicks,
          reach,
          spend: Math.round(spend * 100) / 100,
          cpm: Math.round(cpm * 100) / 100,
          ctr: Math.round(ctr * 100) / 100,
          roas: Math.round(roas * 100) / 100,
          conversions,
        },
      });
      campaignRows++;
    }

    const totalSessions = Math.round(1400 * wave(DAYS - d, 0.3));
    for (const s of ga4Sources) {
      const sessions = Math.round(totalSessions * s.weight);
      await prisma.ga4Metric.upsert({
        where: { date_source_medium: { date: day, source: s.source, medium: s.medium } },
        update: {},
        create: {
          date: day,
          source: s.source,
          medium: s.medium,
          sessions,
          users: Math.round(sessions * 0.82),
          pageviews: Math.round(sessions * 3.4),
          bounceRate: Math.round((35 + Math.random() * 20) * 100) / 100,
        },
      });
      ga4Rows++;
    }
  }

  console.log(`Analytics demo: ${campaignRows} linhas de campanha + ${ga4Rows} linhas GA4`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
