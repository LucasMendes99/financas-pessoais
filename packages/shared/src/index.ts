export type TransactionType = "INCOME" | "EXPENSE";

export type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  type?: TransactionType | null;
};

export type Account = {
  id: string;
  name: string;
  type: "CHECKING" | "SAVINGS" | "WALLET" | "INVESTMENT";
  balance: number;
};

export type Card = {
  id: string;
  name: string;
  brand: string;
  limit: number;
  closingDay: number;
  dueDay: number;
};

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  categoryId: string;
  accountId?: string | null;
  cardId?: string | null;
  isRecurring?: boolean;
};

export type RecurringExpense = {
  id: string;
  description: string;
  amount: number;
  dueDay: number;
  categoryId: string;
  accountId?: string | null;
  active: boolean;
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
  type: "EMERGENCY_RESERVE" | "GOAL";
};

export type DashboardSummary = {
  currentBalance: number;
  incomeTotal: number;
  expenseTotal: number;
  monthly: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
  byCategory: Array<{
    name: string;
    value: number;
    color: string;
  }>;
};
