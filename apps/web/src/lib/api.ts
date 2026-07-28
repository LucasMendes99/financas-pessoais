import type { Account, Card, Category, DashboardSummary, Goal, RecurringExpense, Transaction } from "@financas/shared";
import * as mock from "./mockData";

const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "/api" : "");

const getJson = async <T>(path: string, fallback: T): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) throw new Error("Erro na API");
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
};

const postJson = async <T>(path: string, body: unknown, fallback: T): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error("Erro na API");
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
};

export const api = {
  dashboard: (month: string) => getJson<DashboardSummary>(`/dashboard?month=${month}`, mock.dashboard),
  transactions: (params: URLSearchParams) =>
    getJson<Transaction[]>(`/transactions?${params.toString()}`, mock.transactions),
  createTransaction: (data: Omit<Transaction, "id">) =>
    postJson<Transaction>("/transactions", data, { ...data, id: crypto.randomUUID() }),
  categories: () => getJson<Category[]>("/categories", mock.categories),
  accounts: () => getJson<Account[]>("/accounts", mock.accounts),
  cards: () => getJson<Card[]>("/cards", mock.cards),
  recurringExpenses: () => getJson<RecurringExpense[]>("/recurring-expenses", mock.recurringExpenses),
  goals: () => getJson<Goal[]>("/goals", mock.goals)
};
