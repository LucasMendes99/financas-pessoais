import type { Account, Card, Category, DashboardSummary, Goal, RecurringExpense, Transaction } from "@financas/shared";

export const categories: Category[] = [
  { id: "cat-salario", name: "Salario", color: "#0F766E", icon: "briefcase", type: "INCOME" },
  { id: "cat-freela", name: "Freelance", color: "#2563EB", icon: "laptop", type: "INCOME" },
  { id: "cat-moradia", name: "Moradia", color: "#DC2626", icon: "home", type: "EXPENSE" },
  { id: "cat-mercado", name: "Mercado", color: "#EA580C", icon: "shopping-basket", type: "EXPENSE" },
  { id: "cat-transporte", name: "Transporte", color: "#7C3AED", icon: "car", type: "EXPENSE" },
  { id: "cat-lazer", name: "Lazer", color: "#DB2777", icon: "music", type: "EXPENSE" },
  { id: "cat-saude", name: "Saude", color: "#16A34A", icon: "heart-pulse", type: "EXPENSE" }
];

export const accounts: Account[] = [
  { id: "acc-main", name: "Conta principal", type: "CHECKING", balance: 2450 },
  { id: "acc-reserve", name: "Reserva", type: "SAVINGS", balance: 8500 }
];

export const cards: Card[] = [
  { id: "card-1", name: "Cartao Nubank", brand: "Mastercard", limit: 6000, closingDay: 20, dueDay: 27 }
];

export const transactions: Transaction[] = [
  { id: "tr-1", description: "Salario mensal", amount: 7800, type: "INCOME", date: "2026-07-05", categoryId: "cat-salario", accountId: "acc-main" },
  { id: "tr-2", description: "Projeto landing page", amount: 1200, type: "INCOME", date: "2026-07-12", categoryId: "cat-freela", accountId: "acc-main" },
  { id: "tr-3", description: "Aluguel", amount: 2200, type: "EXPENSE", date: "2026-07-06", categoryId: "cat-moradia", accountId: "acc-main", isRecurring: true },
  { id: "tr-4", description: "Compras da semana", amount: 620, type: "EXPENSE", date: "2026-07-10", categoryId: "cat-mercado", cardId: "card-1" },
  { id: "tr-5", description: "Uber e metro", amount: 180, type: "EXPENSE", date: "2026-07-14", categoryId: "cat-transporte", cardId: "card-1" },
  { id: "tr-6", description: "Cinema", amount: 90, type: "EXPENSE", date: "2026-07-18", categoryId: "cat-lazer", cardId: "card-1" },
  { id: "tr-7", description: "Farmacia", amount: 140, type: "EXPENSE", date: "2026-07-20", categoryId: "cat-saude", accountId: "acc-main" }
];

export const recurringExpenses: RecurringExpense[] = [
  { id: "rec-1", description: "Aluguel", amount: 2200, dueDay: 5, categoryId: "cat-moradia", accountId: "acc-main", active: true },
  { id: "rec-2", description: "Plano de saude", amount: 420, dueDay: 10, categoryId: "cat-saude", accountId: "acc-main", active: true }
];

export const goals: Goal[] = [
  { id: "goal-1", name: "Reserva de emergencia", targetAmount: 30000, currentAmount: 8500, type: "EMERGENCY_RESERVE" },
  { id: "goal-2", name: "Viagem", targetAmount: 12000, currentAmount: 2600, targetDate: "2026-12-20", type: "GOAL" }
];

export const dashboard: DashboardSummary = {
  currentBalance: 16920,
  incomeTotal: 9000,
  expenseTotal: 3230,
  monthly: [
    { month: "2026-02", income: 7600, expense: 3400 },
    { month: "2026-03", income: 7800, expense: 3650 },
    { month: "2026-04", income: 8100, expense: 3920 },
    { month: "2026-05", income: 7800, expense: 3180 },
    { month: "2026-06", income: 8450, expense: 3540 },
    { month: "2026-07", income: 9000, expense: 3230 }
  ],
  byCategory: [
    { name: "Moradia", value: 2200, color: "#DC2626" },
    { name: "Mercado", value: 620, color: "#EA580C" },
    { name: "Transporte", value: 180, color: "#7C3AED" },
    { name: "Lazer", value: 90, color: "#DB2777" },
    { name: "Saude", value: 140, color: "#16A34A" }
  ]
};
