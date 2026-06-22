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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
