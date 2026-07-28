import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = "local-seed-user";

  await prisma.transaction.deleteMany();
  await prisma.recurringExpense.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.card.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();

  const [salario, freelance, moradia, mercado, transporte, lazer, saude] = await Promise.all([
    prisma.category.create({ data: { userId, name: "Salario", color: "#0F766E", icon: "briefcase", type: "INCOME" } }),
    prisma.category.create({ data: { userId, name: "Freelance", color: "#2563EB", icon: "laptop", type: "INCOME" } }),
    prisma.category.create({ data: { userId, name: "Moradia", color: "#DC2626", icon: "home", type: "EXPENSE" } }),
    prisma.category.create({ data: { userId, name: "Mercado", color: "#EA580C", icon: "shopping-basket", type: "EXPENSE" } }),
    prisma.category.create({ data: { userId, name: "Transporte", color: "#7C3AED", icon: "car", type: "EXPENSE" } }),
    prisma.category.create({ data: { userId, name: "Lazer", color: "#DB2777", icon: "music", type: "EXPENSE" } }),
    prisma.category.create({ data: { userId, name: "Saude", color: "#16A34A", icon: "heart-pulse", type: "EXPENSE" } })
  ]);

  const conta = await prisma.account.create({
    data: { userId, name: "Conta principal", type: "CHECKING", balance: 2450 }
  });

  const poupanca = await prisma.account.create({
    data: { userId, name: "Reserva", type: "SAVINGS", balance: 8500 }
  });

  const card = await prisma.card.create({
    data: { userId, name: "Cartao Nubank", brand: "Mastercard", limit: 6000, closingDay: 20, dueDay: 27 }
  });

  await prisma.transaction.createMany({
    data: [
      { userId, description: "Salario mensal", amount: 7800, type: "INCOME", date: new Date(), categoryId: salario.id, accountId: conta.id },
      { userId, description: "Projeto landing page", amount: 1200, type: "INCOME", date: new Date(), categoryId: freelance.id, accountId: conta.id },
      { userId, description: "Aluguel", amount: 2200, type: "EXPENSE", date: new Date(), categoryId: moradia.id, accountId: conta.id, isRecurring: true },
      { userId, description: "Compras da semana", amount: 620, type: "EXPENSE", date: new Date(), categoryId: mercado.id, cardId: card.id },
      { userId, description: "Uber e metro", amount: 180, type: "EXPENSE", date: new Date(), categoryId: transporte.id, cardId: card.id },
      { userId, description: "Cinema", amount: 90, type: "EXPENSE", date: new Date(), categoryId: lazer.id, cardId: card.id },
      { userId, description: "Farmacia", amount: 140, type: "EXPENSE", date: new Date(), categoryId: saude.id, accountId: conta.id }
    ]
  });

  await prisma.recurringExpense.createMany({
    data: [
      { userId, description: "Aluguel", amount: 2200, dueDay: 5, categoryId: moradia.id, accountId: conta.id },
      { userId, description: "Plano de saude", amount: 420, dueDay: 10, categoryId: saude.id, accountId: conta.id }
    ]
  });

  await prisma.goal.createMany({
    data: [
      { userId, name: "Reserva de emergencia", targetAmount: 30000, currentAmount: 8500, type: "EMERGENCY_RESERVE" },
      { userId, name: "Viagem", targetAmount: 12000, currentAmount: 2600, type: "GOAL", targetDate: new Date("2026-12-20") }
    ]
  });

  console.log("Banco populado com dados iniciais.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
