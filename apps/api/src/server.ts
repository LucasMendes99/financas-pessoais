import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, TransactionType } from "@prisma/client";
import { z } from "zod";

const envPaths = [
  join(process.cwd(), ".env"),
  join(process.cwd(), "apps/api/.env"),
  fileURLToPath(new URL("../.env", import.meta.url))
];

for (const path of envPaths) {
  if (existsSync(path)) config({ path });
}

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 3333);
const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);

app.use(cors({ origin: process.env.WEB_ORIGIN ?? ["http://localhost:5180", "http://localhost:5173"] }));
app.use(express.json());

const decimalToNumber = <T extends Record<string, unknown>>(item: T) =>
  Object.fromEntries(
    Object.entries(item).map(([key, value]) => [
      key,
      value && typeof value === "object" && "toNumber" in value
        ? (value as { toNumber: () => number }).toNumber()
        : value
    ])
  );

const transactionSchema = z.object({
  description: z.string().min(2),
  amount: z.coerce.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  date: z.coerce.date(),
  categoryId: z.string(),
  accountId: z.string().nullable().optional(),
  cardId: z.string().nullable().optional(),
  isRecurring: z.boolean().optional()
});

const categorySchema = z.object({
  name: z.string().min(2),
  color: z.string().min(4),
  icon: z.string().min(1),
  type: z.enum(["INCOME", "EXPENSE"]).nullable().optional()
});

const accountSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["CHECKING", "SAVINGS", "WALLET", "INVESTMENT"]),
  balance: z.coerce.number()
});

const cardSchema = z.object({
  name: z.string().min(2),
  brand: z.string().min(2),
  limit: z.coerce.number().positive(),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31)
});

const recurringSchema = z.object({
  description: z.string().min(2),
  amount: z.coerce.number().positive(),
  dueDay: z.coerce.number().int().min(1).max(31),
  categoryId: z.string(),
  accountId: z.string().nullable().optional(),
  active: z.boolean().optional()
});

const goalSchema = z.object({
  name: z.string().min(2),
  targetAmount: z.coerce.number().positive(),
  currentAmount: z.coerce.number().min(0),
  targetDate: z.coerce.date().nullable().optional(),
  type: z.enum(["EMERGENCY_RESERVE", "GOAL"])
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/dashboard", async (req, res, next) => {
  try {
    const month = typeof req.query.month === "string" ? req.query.month : new Date().toISOString().slice(0, 7);
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const [accounts, monthTransactions, allTransactions, categories] = await Promise.all([
      prisma.account.findMany(),
      prisma.transaction.findMany({ where: { date: { gte: start, lt: end } }, include: { category: true } }),
      prisma.transaction.findMany({ include: { category: true } }),
      prisma.category.findMany()
    ]);

    const incomeTotal = monthTransactions
      .filter((item) => item.type === "INCOME")
      .reduce((sum, item) => sum + item.amount.toNumber(), 0);
    const expenseTotal = monthTransactions
      .filter((item) => item.type === "EXPENSE")
      .reduce((sum, item) => sum + item.amount.toNumber(), 0);
    const currentBalance =
      accounts.reduce((sum, account) => sum + account.balance.toNumber(), 0) + incomeTotal - expenseTotal;

    const monthly = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(start);
      date.setUTCMonth(start.getUTCMonth() - (5 - index));
      const key = date.toISOString().slice(0, 7);
      const entries = allTransactions.filter((item) => item.date.toISOString().startsWith(key));
      return {
        month: key,
        income: entries.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + item.amount.toNumber(), 0),
        expense: entries.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + item.amount.toNumber(), 0)
      };
    });

    const byCategory = categories
      .map((category) => ({
        name: category.name,
        color: category.color,
        value: monthTransactions
          .filter((item) => item.type === "EXPENSE" && item.categoryId === category.id)
          .reduce((sum, item) => sum + item.amount.toNumber(), 0)
      }))
      .filter((item) => item.value > 0);

    res.json({ currentBalance, incomeTotal, expenseTotal, monthly, byCategory });
  } catch (error) {
    next(error);
  }
});

app.get("/transactions", async (req, res, next) => {
  try {
    const { month, type, categoryId } = req.query;
    const where: {
      type?: TransactionType;
      categoryId?: string;
      date?: { gte: Date; lt: Date };
    } = {};

    if (typeof type === "string" && ["INCOME", "EXPENSE"].includes(type)) where.type = type as TransactionType;
    if (typeof categoryId === "string" && categoryId) where.categoryId = categoryId;
    if (typeof month === "string" && month) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      where.date = { gte: start, lt: end };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true, account: true, card: true },
      orderBy: { date: "desc" }
    });
    res.json(transactions.map(decimalToNumber));
  } catch (error) {
    next(error);
  }
});

app.post("/transactions", async (req, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);
    const transaction = await prisma.transaction.create({ data });
    res.status(201).json(decimalToNumber(transaction));
  } catch (error) {
    next(error);
  }
});

app.put("/transactions/:id", async (req, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);
    const transaction = await prisma.transaction.update({ where: { id: req.params.id }, data });
    res.json(decimalToNumber(transaction));
  } catch (error) {
    next(error);
  }
});

app.delete("/transactions/:id", async (req, res, next) => {
  try {
    await prisma.transaction.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const crud = <T extends z.ZodTypeAny>(path: string, model: any, schema: T) => {
  app.get(path, async (_req, res, next) => {
    try {
      const items = await model.findMany({ orderBy: { createdAt: "desc" } });
      res.json(items.map(decimalToNumber));
    } catch (error) {
      next(error);
    }
  });

  app.post(path, async (req, res, next) => {
    try {
      const data = schema.parse(req.body);
      const item = await model.create({ data });
      res.status(201).json(decimalToNumber(item));
    } catch (error) {
      next(error);
    }
  });

  app.put(`${path}/:id`, async (req, res, next) => {
    try {
      const data = schema.parse(req.body);
      const item = await model.update({ where: { id: req.params.id }, data });
      res.json(decimalToNumber(item));
    } catch (error) {
      next(error);
    }
  });

  app.delete(`${path}/:id`, async (req, res, next) => {
    try {
      await model.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
};

crud("/categories", prisma.category, categorySchema);
crud("/accounts", prisma.account, accountSchema);
crud("/cards", prisma.card, cardSchema);
crud("/recurring-expenses", prisma.recurringExpense, recurringSchema);
crud("/goals", prisma.goal, goalSchema);

if (process.env.NODE_ENV === "production") {
  const webDistCandidates = [
    join(process.cwd(), "apps/web/dist"),
    join(process.cwd(), "../web/dist"),
    join(currentDir, "../../../web/dist")
  ];
  const webDist = webDistCandidates.find((path) => existsSync(join(path, "index.html")));

  if (webDist) {
    app.use(express.static(webDist));
    app.get(/.*/, (_req, res) => {
      res.sendFile(join(webDist, "index.html"));
    });
  } else {
    console.warn("Frontend compilado nao encontrado. Rode npm run build antes de iniciar em producao.");
  }
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: "Dados invalidos", issues: error.issues });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Erro interno do servidor" });
});

app.listen(port, () => {
  console.log(`API de financas rodando em http://localhost:${port}`);
});
