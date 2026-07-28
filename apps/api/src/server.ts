import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, TransactionType } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type AuthenticatedRequest = express.Request & { userId: string };

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
const supabaseUrl = process.env.SUPABASE_URL ?? "https://nmgksbiafdpokaxljiqg.supabase.co";
const supabaseKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "sb_publishable_TkYMHRQ5yz7fVssYxKYiyA_JNVDPRD9";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const defaultWebOrigins = [
  "http://localhost:5180",
  "http://localhost:5173",
  "https://financas-pessoais-two-beige.vercel.app"
];
const webOrigins = (process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(",") : defaultWebOrigins).map((origin) =>
  origin.trim()
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || webOrigins.includes(origin) || /^https:\/\/financas-pessoais.*\.vercel\.app$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem não permitida pelo CORS"));
    }
  })
);
app.use(express.json());

const requireAuth: express.RequestHandler = async (req, res, next) => {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

  if (!token) {
    res.status(401).json({ message: "Token de autenticação ausente" });
    return;
  }

  if (!supabase) {
    res.status(500).json({ message: "Supabase não configurado na API" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ message: "Token de autenticação inválido" });
    return;
  }

  (req as AuthenticatedRequest).userId = data.user.id;
  next();
};

const getUserId = (req: express.Request) => (req as AuthenticatedRequest).userId;

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

const validateTransactionRefs = async (data: z.infer<typeof transactionSchema>, userId: string) => {
  const [category, account, card] = await Promise.all([
    prisma.category.findFirst({ where: { id: data.categoryId, userId } }),
    data.accountId ? prisma.account.findFirst({ where: { id: data.accountId, userId } }) : Promise.resolve(null),
    data.cardId ? prisma.card.findFirst({ where: { id: data.cardId, userId } }) : Promise.resolve(null)
  ]);

  return Boolean(category && (!data.accountId || account) && (!data.cardId || card));
};

const validateRecurringRefs = async (data: z.infer<typeof recurringSchema>, userId: string) => {
  const [category, account] = await Promise.all([
    prisma.category.findFirst({ where: { id: data.categoryId, userId } }),
    data.accountId ? prisma.account.findFirst({ where: { id: data.accountId, userId } }) : Promise.resolve(null)
  ]);

  return Boolean(category && (!data.accountId || account));
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(
  ["/dashboard", "/transactions", "/categories", "/accounts", "/cards", "/recurring-expenses", "/goals"],
  requireAuth
);

app.get("/dashboard", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const month = typeof req.query.month === "string" ? req.query.month : new Date().toISOString().slice(0, 7);
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const [accounts, monthTransactions, allTransactions, categories] = await Promise.all([
      prisma.account.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId, date: { gte: start, lt: end } }, include: { category: true } }),
      prisma.transaction.findMany({ where: { userId }, include: { category: true } }),
      prisma.category.findMany({ where: { userId } })
    ]);

    const financialMonthTransactions = monthTransactions.filter((item) => item.category?.type !== null);

    const incomeTotal = financialMonthTransactions
      .filter((item) => item.type === "INCOME")
      .reduce((sum, item) => sum + item.amount.toNumber(), 0);
    const expenseTotal = financialMonthTransactions
      .filter((item) => item.type === "EXPENSE")
      .reduce((sum, item) => sum + item.amount.toNumber(), 0);
    const currentBalance =
      accounts.reduce((sum, account) => sum + account.balance.toNumber(), 0) + incomeTotal - expenseTotal;

    const monthly = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(start);
      date.setUTCMonth(start.getUTCMonth() - (5 - index));
      const key = date.toISOString().slice(0, 7);
      const entries = allTransactions.filter((item) => item.category?.type !== null && item.date.toISOString().startsWith(key));
      return {
        month: key,
        income: entries.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + item.amount.toNumber(), 0),
        expense: entries.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + item.amount.toNumber(), 0)
      };
    });

    const byCategory = categories
      .filter((category) => category.type === "EXPENSE")
      .map((category) => ({
        name: category.name,
        color: category.color,
        value: financialMonthTransactions
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
    const userId = getUserId(req);
    const { month, type, categoryId } = req.query;
    const where: {
      userId: string;
      type?: TransactionType;
      categoryId?: string;
      date?: { gte: Date; lt: Date };
    } = { userId };

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
    const userId = getUserId(req);
    const data = transactionSchema.parse(req.body);
    if (!(await validateTransactionRefs(data, userId))) {
      res.status(400).json({ message: "Categoria, conta ou cartão inválido para este usuário" });
      return;
    }

    const transaction = await prisma.transaction.create({ data: { ...data, userId } });
    res.status(201).json(decimalToNumber(transaction));
  } catch (error) {
    next(error);
  }
});

app.put("/transactions/:id", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const data = transactionSchema.parse(req.body);
    const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) {
      res.status(404).json({ message: "Lançamento não encontrado" });
      return;
    }
    if (!(await validateTransactionRefs(data, userId))) {
      res.status(400).json({ message: "Categoria, conta ou cartão inválido para este usuário" });
      return;
    }
    const transaction = await prisma.transaction.update({ where: { id: req.params.id }, data });
    res.json(decimalToNumber(transaction));
  } catch (error) {
    next(error);
  }
});

app.delete("/transactions/:id", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await prisma.transaction.deleteMany({ where: { id: req.params.id, userId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const crud = <T extends z.ZodTypeAny>(
  path: string,
  model: any,
  schema: T,
  validate?: (data: z.infer<T>, userId: string) => Promise<boolean>
) => {
  app.get(path, async (req, res, next) => {
    try {
      const userId = getUserId(req);
      const items = await model.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
      res.json(items.map(decimalToNumber));
    } catch (error) {
      next(error);
    }
  });

  app.post(path, async (req, res, next) => {
    try {
      const userId = getUserId(req);
      const data = schema.parse(req.body);
      if (validate && !(await validate(data, userId))) {
        res.status(400).json({ message: "Dados relacionados inválidos para este usuário" });
        return;
      }
      const createData = data as Record<string, unknown>;
      const item = await model.create({ data: { ...createData, userId } });
      res.status(201).json(decimalToNumber(item));
    } catch (error) {
      next(error);
    }
  });

  app.put(`${path}/:id`, async (req, res, next) => {
    try {
      const userId = getUserId(req);
      const data = schema.parse(req.body);
      const existing = await model.findFirst({ where: { id: req.params.id, userId } });
      if (!existing) {
        res.status(404).json({ message: "Registro não encontrado" });
        return;
      }
      if (validate && !(await validate(data, userId))) {
        res.status(400).json({ message: "Dados relacionados inválidos para este usuário" });
        return;
      }
      const item = await model.update({ where: { id: req.params.id }, data });
      res.json(decimalToNumber(item));
    } catch (error) {
      next(error);
    }
  });

  app.delete(`${path}/:id`, async (req, res, next) => {
    try {
      const userId = getUserId(req);
      await model.deleteMany({ where: { id: req.params.id, userId } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
};

crud("/categories", prisma.category, categorySchema);
crud("/accounts", prisma.account, accountSchema);
crud("/cards", prisma.card, cardSchema);
crud("/recurring-expenses", prisma.recurringExpense, recurringSchema, validateRecurringRefs);
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
    console.warn("Frontend compilado não encontrado. Rode npm run build antes de iniciar em produção.");
  }
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: "Dados inválidos", issues: error.issues });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Erro interno do servidor" });
});

app.listen(port, () => {
  console.log(`API de financas rodando em http://localhost:${port}`);
});
