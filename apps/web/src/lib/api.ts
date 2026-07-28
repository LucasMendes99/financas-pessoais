import type { Account, Card, Category, DashboardSummary, Goal, RecurringExpense, Transaction } from "@financas/shared";

const PRODUCTION_API_URL = "https://financas-pessoais-tg1y.onrender.com";
const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "/api" : PRODUCTION_API_URL);

let accessTokenProvider: (() => Promise<string | null>) | null = null;

export const setAccessTokenProvider = (provider: () => Promise<string | null>) => {
  accessTokenProvider = provider;
};

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = accessTokenProvider ? await accessTokenProvider() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const emptyDashboard = (month: string): DashboardSummary => {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  return {
    currentBalance: 0,
    incomeTotal: 0,
    expenseTotal: 0,
    monthly: Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(start);
      date.setUTCMonth(start.getUTCMonth() - (5 - index));
      return { month: date.toISOString().slice(0, 7), income: 0, expense: 0 };
    }),
    byCategory: []
  };
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Erro na API");
  }
  return (await response.json()) as T;
};

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: await authHeaders()
  });
  return parseResponse<T>(response);
};

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
};

const putJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
};

const deleteJson = async (path: string): Promise<void> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: await authHeaders()
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Erro na API");
  }
};

export const api = {
  dashboard: (month: string) => getJson<DashboardSummary>(`/dashboard?month=${month}`),
  transactions: (params: URLSearchParams) => getJson<Transaction[]>(`/transactions?${params.toString()}`),
  createTransaction: (data: Omit<Transaction, "id">) => postJson<Transaction>("/transactions", data),
  updateTransaction: (id: string, data: Omit<Transaction, "id">) => putJson<Transaction>(`/transactions/${id}`, data),
  deleteTransaction: (id: string) => deleteJson(`/transactions/${id}`),
  categories: () => getJson<Category[]>("/categories"),
  createCategory: (data: Omit<Category, "id">) => postJson<Category>("/categories", data),
  updateCategory: (id: string, data: Omit<Category, "id">) => putJson<Category>(`/categories/${id}`, data),
  deleteCategory: (id: string) => deleteJson(`/categories/${id}`),
  accounts: () => getJson<Account[]>("/accounts"),
  createAccount: (data: Omit<Account, "id">) => postJson<Account>("/accounts", data),
  updateAccount: (id: string, data: Omit<Account, "id">) => putJson<Account>(`/accounts/${id}`, data),
  deleteAccount: (id: string) => deleteJson(`/accounts/${id}`),
  cards: () => getJson<Card[]>("/cards"),
  createCard: (data: Omit<Card, "id">) => postJson<Card>("/cards", data),
  updateCard: (id: string, data: Omit<Card, "id">) => putJson<Card>(`/cards/${id}`, data),
  deleteCard: (id: string) => deleteJson(`/cards/${id}`),
  recurringExpenses: () => getJson<RecurringExpense[]>("/recurring-expenses"),
  createRecurringExpense: (data: Omit<RecurringExpense, "id">) => postJson<RecurringExpense>("/recurring-expenses", data),
  updateRecurringExpense: (id: string, data: Omit<RecurringExpense, "id">) => putJson<RecurringExpense>(`/recurring-expenses/${id}`, data),
  deleteRecurringExpense: (id: string) => deleteJson(`/recurring-expenses/${id}`),
  goals: () => getJson<Goal[]>("/goals"),
  createGoal: (data: Omit<Goal, "id">) => postJson<Goal>("/goals", data),
  updateGoal: (id: string, data: Omit<Goal, "id">) => putJson<Goal>(`/goals/${id}`, data),
  deleteGoal: (id: string) => deleteJson(`/goals/${id}`)
};
