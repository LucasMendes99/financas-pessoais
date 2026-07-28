import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Banknote,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  CreditCard,
  Filter,
  Flag,
  LayoutDashboard,
  LogOut,
  Moon,
  Pencil,
  Plus,
  ReceiptText,
  Sun,
  Tags,
  Target,
  Trash2,
  WalletCards,
  X,
  ArrowRightLeft
} from "lucide-react";
import type { Account, Card as CardType, Category, DashboardSummary, Goal, RecurringExpense, Transaction, TransactionType } from "@financas/shared";
import { Card } from "./components/Card";
import { api, emptyDashboard, setAccessTokenProvider } from "./lib/api";
import { brl, formatDate, monthLabel } from "./lib/format";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type View = "dashboard" | "transactions" | "categories" | "accounts" | "recurring" | "charts" | "goals";
type Theme = "light" | "dark";
type QuickAction = "expense" | "income" | "card-expense" | "transfer";

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transactions", label: "Lançamentos", icon: ReceiptText },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "accounts", label: "Contas", icon: CreditCard },
  { id: "recurring", label: "Fixas", icon: CalendarDays },
  { id: "charts", label: "Gráficos", icon: ChartNoAxesCombined },
  { id: "goals", label: "Metas", icon: Target }
];

const categoryName = (categories: Category[], id: string) => categories.find((item) => item.id === id)?.name ?? "Sem categoria";

const currentMonth = "2026-07";

const reportActionError = (error: unknown) => {
  window.alert(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [month, setMonth] = useState(currentMonth);
  const [type, setType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadError, setLoadError] = useState("");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") === "dark" ? "dark" : "light"));
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    const client = supabase;

    setAccessTokenProvider(async () => {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    });

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    Promise.all([api.categories(), api.accounts(), api.cards(), api.recurringExpenses(), api.goals()])
      .then(([nextCategories, nextAccounts, nextCards, nextRecurring, nextGoals]) => {
        setCategories(nextCategories);
        setAccounts(nextAccounts);
        setCards(nextCards);
        setRecurring(nextRecurring);
        setGoals(nextGoals);
        setLoadError("");
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Erro ao carregar dados"));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    api.dashboard(month)
      .then((nextDashboard) => {
        setDashboard(nextDashboard);
        setLoadError("");
      })
      .catch((error) => {
        setDashboard(emptyDashboard(month));
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar dashboard");
      });
  }, [month, session]);

  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams();
    params.set("month", month);
    if (type) params.set("type", type);
    if (categoryId) params.set("categoryId", categoryId);
    api.transactions(params)
      .then((nextTransactions) => {
        setTransactions(nextTransactions);
        setLoadError("");
      })
      .catch((error) => {
        setTransactions([]);
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar lançamentos");
      });
  }, [month, type, categoryId, session]);

  const expenseCategories = useMemo(() => categories.filter((item) => item.type !== "INCOME"), [categories]);

  const stats = [
    { label: "Saldo atual", value: dashboard?.currentBalance ?? 0, icon: WalletCards, tone: "text-slate-900 dark:text-slate-100" },
    { label: "Receitas", value: dashboard?.incomeTotal ?? 0, icon: Banknote, tone: "text-emerald-700" },
    { label: "Despesas", value: dashboard?.expenseTotal ?? 0, icon: ReceiptText, tone: "text-rose-700" }
  ];

  const createTransaction = async (data: Omit<Transaction, "id">) => {
    const created = await api.createTransaction(data);
    setTransactions((current) => [created, ...current]);
    setDashboard((current) => {
      if (!current) return current;
      const incomeDelta = created.type === "INCOME" ? created.amount : 0;
      const expenseDelta = created.type === "EXPENSE" ? created.amount : 0;
      return {
        ...current,
        currentBalance: current.currentBalance + incomeDelta - expenseDelta,
        incomeTotal: current.incomeTotal + incomeDelta,
        expenseTotal: current.expenseTotal + expenseDelta
      };
    });
  };

  const refreshDashboard = async () => {
    setDashboard(await api.dashboard(month));
  };

  const createTransactionAndRefresh = async (data: Omit<Transaction, "id">) => {
    await createTransaction(data);
    await refreshDashboard();
  };

  const updateTransaction = async (id: string, data: Omit<Transaction, "id">) => {
    const updated = await api.updateTransaction(id, data);
    setTransactions((current) => current.map((item) => (item.id === id ? updated : item)));
    await refreshDashboard();
  };

  const deleteTransaction = async (id: string) => {
    await api.deleteTransaction(id);
    setTransactions((current) => current.filter((item) => item.id !== id));
    await refreshDashboard();
  };

  const createCategory = async (data: Omit<Category, "id">) => {
    const created = await api.createCategory(data);
    setCategories((current) => [created, ...current]);
  };

  const updateCategory = async (id: string, data: Omit<Category, "id">) => {
    const updated = await api.updateCategory(id, data);
    setCategories((current) => current.map((item) => (item.id === id ? updated : item)));
    await refreshDashboard();
  };

  const deleteCategory = async (id: string) => {
    await api.deleteCategory(id);
    setCategories((current) => current.filter((item) => item.id !== id));
    await refreshDashboard();
  };

  const createAccount = async (data: Omit<Account, "id">) => {
    const created = await api.createAccount(data);
    setAccounts((current) => [created, ...current]);
    await refreshDashboard();
  };

  const updateAccount = async (id: string, data: Omit<Account, "id">) => {
    const updated = await api.updateAccount(id, data);
    setAccounts((current) => current.map((item) => (item.id === id ? updated : item)));
    await refreshDashboard();
  };

  const deleteAccount = async (id: string) => {
    await api.deleteAccount(id);
    setAccounts((current) => current.filter((item) => item.id !== id));
    await refreshDashboard();
  };

  const createCard = async (data: Omit<CardType, "id">) => {
    const created = await api.createCard(data);
    setCards((current) => [created, ...current]);
  };

  const updateCard = async (id: string, data: Omit<CardType, "id">) => {
    const updated = await api.updateCard(id, data);
    setCards((current) => current.map((item) => (item.id === id ? updated : item)));
  };

  const deleteCard = async (id: string) => {
    await api.deleteCard(id);
    setCards((current) => current.filter((item) => item.id !== id));
  };

  const createRecurringExpense = async (data: Omit<RecurringExpense, "id">) => {
    const created = await api.createRecurringExpense(data);
    setRecurring((current) => [created, ...current]);
  };

  const updateRecurringExpense = async (id: string, data: Omit<RecurringExpense, "id">) => {
    const updated = await api.updateRecurringExpense(id, data);
    setRecurring((current) => current.map((item) => (item.id === id ? updated : item)));
  };

  const deleteRecurringExpense = async (id: string) => {
    await api.deleteRecurringExpense(id);
    setRecurring((current) => current.filter((item) => item.id !== id));
  };

  const createGoal = async (data: Omit<Goal, "id">) => {
    const created = await api.createGoal(data);
    setGoals((current) => [created, ...current]);
  };

  const updateGoal = async (id: string, data: Omit<Goal, "id">) => {
    const updated = await api.updateGoal(id, data);
    setGoals((current) => current.map((item) => (item.id === id ? updated : item)));
  };

  const deleteGoal = async (id: string) => {
    await api.deleteGoal(id);
    setGoals((current) => current.filter((item) => item.id !== id));
  };

  const createTransfer = async (data: {
    description: string;
    amount: number;
    date: string;
    fromAccountId: string;
    toAccountId: string;
  }) => {
    let transferCategory = categories.find((item) => item.name.toLowerCase() === "transferência");

    if (!transferCategory) {
      transferCategory = await api.createCategory({
        name: "Transferência",
        color: "#2563EB",
        icon: "arrow-right-left",
        type: null
      });
      setCategories((current) => [transferCategory!, ...current]);
    }

    const [expense, income] = await Promise.all([
      api.createTransaction({
        description: `${data.description} - saída`,
        amount: data.amount,
        type: "EXPENSE",
        date: data.date,
        categoryId: transferCategory.id,
        accountId: data.fromAccountId,
        cardId: null,
        isRecurring: false
      }),
      api.createTransaction({
        description: `${data.description} - entrada`,
        amount: data.amount,
        type: "INCOME",
        date: data.date,
        categoryId: transferCategory.id,
        accountId: data.toAccountId,
        cardId: null,
        isRecurring: false
      })
    ]);

    setTransactions((current) => [income, expense, ...current]);
    await refreshDashboard();
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  if (!isSupabaseConfigured) {
    return <AuthSetupMissing />;
  }

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
        <p className="text-sm font-medium">Carregando autenticação...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-paper text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-white">
            <WalletCards size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold">Finanças Pessoais</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Controle simples</p>
          </div>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                view === item.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              }`}
              onClick={() => setView(item.id)}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="pb-24 lg:ml-64 lg:pb-8">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-paper/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Julho de 2026</p>
              <h1 className="text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">{navItems.find((item) => item.id === view)?.label}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
                title={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-950" onClick={() => setQuickAction("expense")}>
                <Plus size={16} />
                Novo
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                onClick={signOut}
                title="Sair"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 sm:px-6 lg:px-8">
          {loadError && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {loadError}
            </div>
          )}

          {view === "dashboard" && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                {stats.map((item) => (
                  <Card key={item.label}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{brl.format(item.value)}</p>
                      </div>
                      <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <item.icon size={21} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <FirstSteps
                accounts={accounts}
                cards={cards}
                transactions={transactions}
                onOpenAccounts={() => setView("accounts")}
                onOpenIncome={() => setQuickAction("income")}
                onOpenExpense={() => setQuickAction("expense")}
              />
              <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
                <MonthlyChart data={dashboard?.monthly ?? []} />
                <CategoryPie data={dashboard?.byCategory ?? []} />
              </div>
              <TransactionsTable
                transactions={transactions.slice(0, 5)}
                categories={categories}
                accounts={accounts}
                cards={cards}
                title="Últimos lançamentos"
                onUpdate={updateTransaction}
                onDelete={deleteTransaction}
              />
            </div>
          )}

          {view === "transactions" && (
            <div className="space-y-5">
              <Card title="Filtros" action={<Filter size={18} className="text-slate-500" />}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={type} onChange={(event) => setType(event.target.value)}>
                    <option value="">Todos os tipos</option>
                    <option value="INCOME">Receitas</option>
                    <option value="EXPENSE">Despesas</option>
                  </select>
                  <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">Todas as categorias</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <button className="h-10 rounded-lg border border-slate-200 text-sm font-medium dark:border-slate-700" onClick={() => { setType(""); setCategoryId(""); }}>
                    Limpar filtros
                  </button>
                </div>
              </Card>
              <TransactionForm categories={categories} accounts={accounts} cards={cards} onSubmit={createTransactionAndRefresh} />
              <TransactionsTable
                transactions={transactions}
                categories={categories}
                accounts={accounts}
                cards={cards}
                title="Lançamentos do mês"
                onUpdate={updateTransaction}
                onDelete={deleteTransaction}
              />
            </div>
          )}

          {view === "categories" && (
            <CategoriesView categories={categories} onCreate={createCategory} onUpdate={updateCategory} onDelete={deleteCategory} />
          )}
          {view === "accounts" && (
            <AccountsView
              accounts={accounts}
              cards={cards}
              onCreateAccount={createAccount}
              onUpdateAccount={updateAccount}
              onDeleteAccount={deleteAccount}
              onCreateCard={createCard}
              onUpdateCard={updateCard}
              onDeleteCard={deleteCard}
            />
          )}
          {view === "recurring" && (
            <RecurringView
              recurring={recurring}
              categories={categories}
              accounts={accounts}
              onCreate={createRecurringExpense}
              onUpdate={updateRecurringExpense}
              onDelete={deleteRecurringExpense}
            />
          )}
          {view === "charts" && (
            <div className="grid gap-5 xl:grid-cols-2">
              <MonthlyChart data={dashboard?.monthly ?? []} />
              <CategoryPie data={dashboard?.byCategory ?? []} />
            </div>
          )}
          {view === "goals" && <GoalsView goals={goals} onCreate={createGoal} onUpdate={updateGoal} onDelete={deleteGoal} />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-7 border-t border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] ${view === item.id ? "text-slate-950 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}
            aria-label={item.label}
          >
            <item.icon size={18} />
            <span className="hidden min-[430px]:inline">{item.label}</span>
          </button>
        ))}
      </nav>
      <QuickActionModal
        action={quickAction}
        categories={categories}
        accounts={accounts}
        cards={cards}
        onClose={() => setQuickAction(null)}
        onSelect={setQuickAction}
        onCreateTransaction={async (data) => {
          await createTransactionAndRefresh(data);
          setQuickAction(null);
        }}
        onCreateTransfer={async (data) => {
          await createTransfer(data);
          setQuickAction(null);
        }}
      />
    </div>
  );
}

function AuthSetupMissing() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <Card title="Supabase não configurado">
        <div className="max-w-lg space-y-3 text-sm text-slate-600">
          <p>Crie o arquivo apps/web/.env.local com as variáveis abaixo e reinicie o servidor do frontend.</p>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-white">
            VITE_SUPABASE_URL="https://seu-projeto.supabase.co"{`\n`}
            VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-publicável"
          </pre>
        </div>
      </Card>
    </div>
  );
}

function AuthView() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setMessage("");

    const response =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (response.error) {
      setMessage(response.error.message);
    } else if (mode === "signup") {
      setMessage("Cadastro criado. Verifique seu e-mail se a confirmação estiver ativa no Supabase.");
    }

    setLoading(false);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-900 text-white">
            <WalletCards size={21} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-white">Finanças Pessoais</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Acesse sua área protegida</p>
          </div>
        </div>

        <Card title={mode === "signin" ? "Entrar" : "Criar conta"}>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>

            {message && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{message}</p>}

            <button className="h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white" disabled={loading} type="submit">
              {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Cadastrar"}
            </button>
          </form>

          <button
            className="mt-4 w-full text-sm font-medium text-slate-700"
            onClick={() => {
              setMode((current) => (current === "signin" ? "signup" : "signin"));
              setMessage("");
            }}
          >
            {mode === "signin" ? "Criar uma conta" : "Já tenho conta"}
          </button>
        </Card>
      </div>
    </div>
  );
}

function MonthlyChart({ data }: { data: DashboardSummary["monthly"] }) {
  return (
    <Card title="Evolução mensal">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.map((item) => ({ ...item, month: monthLabel(item.month) }))}>
            <defs>
              <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0F766E" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value) / 1000}k`} />
            <Tooltip formatter={(value) => brl.format(Number(value))} />
            <Legend />
            <Area type="monotone" dataKey="income" name="Receitas" stroke="#0F766E" fill="url(#income)" strokeWidth={2} />
            <Area type="monotone" dataKey="expense" name="Despesas" stroke="#DC2626" fill="url(#expense)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function CategoryPie({ data }: { data: DashboardSummary["byCategory"] }) {
  return (
    <Card title="Despesas por categoria">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => brl.format(Number(value))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function TransactionForm({
  categories,
  accounts,
  cards,
  onSubmit,
  title = "Cadastrar receita ou despesa",
  initialType = "EXPENSE",
  lockType = false,
  requireCard = false,
  editingItem,
  onCancelEdit
}: {
  categories: Category[];
  accounts: Account[];
  cards: CardType[];
  onSubmit: (data: Omit<Transaction, "id">) => Promise<void>;
  title?: string;
  initialType?: "INCOME" | "EXPENSE";
  lockType?: boolean;
  requireCard?: boolean;
  editingItem?: Transaction | null;
  onCancelEdit?: () => void;
}) {
  const [description, setDescription] = useState(editingItem?.description ?? "");
  const [amount, setAmount] = useState(editingItem ? String(editingItem.amount) : "");
  const [transactionType, setTransactionType] = useState<"INCOME" | "EXPENSE">(editingItem?.type ?? initialType);
  const [selectedCategoryId, setSelectedCategoryId] = useState(editingItem?.categoryId ?? "");
  const [selectedAccountId, setSelectedAccountId] = useState(editingItem?.accountId ?? "");
  const [selectedCardId, setSelectedCardId] = useState(editingItem?.cardId ?? "");
  const [date, setDate] = useState(editingItem?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [isRecurring, setIsRecurring] = useState(Boolean(editingItem?.isRecurring));
  const availableCategories = categories.filter((item) => !item.type || item.type === transactionType);

  useEffect(() => {
    setDescription(editingItem?.description ?? "");
    setAmount(editingItem ? String(editingItem.amount) : "");
    setTransactionType(editingItem?.type ?? initialType);
    setSelectedCategoryId(editingItem?.categoryId ?? "");
    setSelectedAccountId(editingItem?.accountId ?? accounts[0]?.id ?? "");
    setSelectedCardId(editingItem?.cardId ?? "");
    setDate(editingItem?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setIsRecurring(Boolean(editingItem?.isRecurring));
  }, [accounts, editingItem, initialType]);

  useEffect(() => {
    if (!availableCategories.some((item) => item.id === selectedCategoryId)) {
      setSelectedCategoryId(availableCategories[0]?.id ?? "");
    }
  }, [availableCategories, selectedCategoryId]);

  useEffect(() => {
    setSelectedAccountId(accounts[0]?.id ?? "");
  }, [accounts]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!description.trim() || !amount || !selectedCategoryId || (requireCard && !selectedCardId)) return;
    await onSubmit({
      description: description.trim(),
      amount: Number(amount),
      type: transactionType,
      date,
      categoryId: selectedCategoryId,
      accountId: selectedAccountId || null,
      cardId: selectedCardId || null,
      isRecurring
    });
    setDescription("");
    setAmount("");
    onCancelEdit?.();
  };

  const canSubmit = Boolean(description.trim() && amount && selectedCategoryId && (!requireCard || selectedCardId));

  return (
    <Card title={title}>
      {categories.length === 0 && (
        <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Cadastre uma categoria antes de adicionar lançamentos.
        </p>
      )}
      {requireCard && cards.length === 0 && (
        <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Cadastre um cartão antes de lançar despesas de cartão.
        </p>
      )}
      <form className="grid gap-3 lg:grid-cols-6" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2" placeholder="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Valor" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800" value={transactionType} onChange={(event) => setTransactionType(event.target.value as "INCOME" | "EXPENSE")} disabled={lockType}>
          <option value="INCOME">Receita</option>
          <option value="EXPENSE">Despesa</option>
        </select>
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
          <option value="">Selecione uma categoria</option>
          {availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
          <option value="">Sem conta</option>
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2" value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)}>
          <option value="">{requireCard ? "Selecione um cartão" : "Sem cartão"}</option>
          {cards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200 lg:col-span-2">
          <input
            className="h-4 w-4 accent-slate-900 dark:accent-white"
            type="checkbox"
            checked={isRecurring}
            onChange={(event) => setIsRecurring(event.target.checked)}
          />
          Repetir todo mês
        </label>
        <button type="submit" className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-950 lg:col-span-2" disabled={!canSubmit}>
          {editingItem ? "Atualizar lançamento" : "Salvar lançamento"}
        </button>
        {editingItem && (
          <button type="button" className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700 lg:col-span-2" onClick={onCancelEdit}>
            Cancelar edição
          </button>
        )}
      </form>
    </Card>
  );
}

function TransactionsTable({
  transactions,
  categories,
  accounts,
  cards,
  title,
  onUpdate,
  onDelete
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  cards: CardType[];
  title: string;
  onUpdate: (id: string, data: Omit<Transaction, "id">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Transaction | null>(null);

  const confirmDelete = async (item: Transaction) => {
    if (!window.confirm(`Excluir "${item.description}"?`)) return;
    try {
      await onDelete(item.id);
    } catch (error) {
      reportActionError(error);
    }
  };

  return (
    <Card title={title}>
      {editing && (
        <div className="mb-4">
          <TransactionForm
            title="Editar lançamento"
            categories={categories}
            accounts={accounts}
            cards={cards}
            editingItem={editing}
            onCancelEdit={() => setEditing(null)}
            onSubmit={async (data) => {
              await onUpdate(editing.id, data);
              setEditing(null);
            }}
          />
        </div>
      )}
      {transactions.length === 0 ? (
        <EmptyState message="Nenhum lançamento cadastrado ainda." />
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="pb-3">Descrição</th>
              <th className="pb-3">Categoria</th>
              <th className="pb-3">Data</th>
              <th className="pb-3">Tipo</th>
              <th className="pb-3">Recorrência</th>
              <th className="pb-3 text-right">Valor</th>
              <th className="pb-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((item) => (
              <tr key={item.id}>
                <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{item.description}</td>
                <td className="py-3 text-slate-600 dark:text-slate-300">{categoryName(categories, item.categoryId)}</td>
                <td className="py-3 text-slate-600 dark:text-slate-300">{formatDate(item.date)}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${item.type === "INCOME" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {item.type === "INCOME" ? "Receita" : "Despesa"}
                  </span>
                </td>
                <td className="py-3">
                  {item.isRecurring ? (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      Recorrente
                    </span>
                  ) : (
                    <span className="text-slate-400">Único</span>
                  )}
                </td>
                <td className={`py-3 text-right font-semibold ${item.type === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
                  {item.type === "INCOME" ? "+" : "-"} {brl.format(item.amount)}
                </td>
                <td className="py-3">
                  <RowActions onEdit={() => setEditing(item)} onDelete={() => confirmDelete(item)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </Card>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={onEdit} title="Editar">
        <Pencil size={15} />
      </button>
      <button className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950" onClick={onDelete} title="Excluir">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-300">{message}</p>;
}

function FirstSteps({
  accounts,
  cards,
  transactions,
  onOpenAccounts,
  onOpenIncome,
  onOpenExpense
}: {
  accounts: Account[];
  cards: CardType[];
  transactions: Transaction[];
  onOpenAccounts: () => void;
  onOpenIncome: () => void;
  onOpenExpense: () => void;
}) {
  const steps = [
    {
      label: "Crie sua primeira conta bancária",
      done: accounts.length > 0,
      action: onOpenAccounts
    },
    {
      label: "Configure um cartão de crédito",
      done: cards.length > 0,
      action: onOpenAccounts
    },
    {
      label: "Cadastre sua primeira receita",
      done: transactions.some((item) => item.type === "INCOME"),
      action: onOpenIncome
    },
    {
      label: "Cadastre sua primeira despesa",
      done: transactions.some((item) => item.type === "EXPENSE"),
      action: onOpenExpense
    }
  ];

  if (steps.every((item) => item.done)) return null;

  return (
    <Card title="Primeiros passos">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((item) => (
          <button
            key={item.label}
            className="flex min-h-24 items-start gap-3 rounded-lg border border-slate-200 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            onClick={item.action}
          >
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${item.done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}`}>
              {item.done ? <CheckCircle2 size={16} /> : <Plus size={16} />}
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{item.done ? "Concluído" : "Pendente"}</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function QuickActionModal({
  action,
  categories,
  accounts,
  cards,
  onClose,
  onSelect,
  onCreateTransaction,
  onCreateTransfer
}: {
  action: QuickAction | null;
  categories: Category[];
  accounts: Account[];
  cards: CardType[];
  onClose: () => void;
  onSelect: (action: QuickAction) => void;
  onCreateTransaction: (data: Omit<Transaction, "id">) => Promise<void>;
  onCreateTransfer: (data: {
    description: string;
    amount: number;
    date: string;
    fromAccountId: string;
    toAccountId: string;
  }) => Promise<void>;
}) {
  if (!action) return null;

  const options: Array<{ id: QuickAction; label: string; icon: typeof ReceiptText }> = [
    { id: "expense", label: "Despesa", icon: ReceiptText },
    { id: "income", label: "Receita", icon: Banknote },
    { id: "card-expense", label: "Despesa de cartão", icon: CreditCard },
    { id: "transfer", label: "Transferência", icon: ArrowRightLeft }
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="mx-auto max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-xl bg-paper p-4 shadow-2xl dark:bg-slate-950 sm:rounded-xl sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Novo registro</p>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Escolha o que deseja adicionar</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          {options.map((item) => (
            <button
              key={item.id}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                action === item.id
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              }`}
              onClick={() => onSelect(item.id)}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>

        {action === "expense" && (
          <TransactionForm
            title="Cadastrar despesa"
            initialType="EXPENSE"
            lockType
            categories={categories}
            accounts={accounts}
            cards={cards}
            onSubmit={onCreateTransaction}
          />
        )}
        {action === "income" && (
          <TransactionForm
            title="Cadastrar receita"
            initialType="INCOME"
            lockType
            categories={categories}
            accounts={accounts}
            cards={cards}
            onSubmit={onCreateTransaction}
          />
        )}
        {action === "card-expense" && (
          <TransactionForm
            title="Cadastrar despesa de cartão"
            initialType="EXPENSE"
            lockType
            requireCard
            categories={categories}
            accounts={accounts}
            cards={cards}
            onSubmit={onCreateTransaction}
          />
        )}
        {action === "transfer" && <TransferForm accounts={accounts} onCreate={onCreateTransfer} />}
      </div>
    </div>
  );
}

function TransferForm({
  accounts,
  onCreate
}: {
  accounts: Account[];
  onCreate: (data: {
    description: string;
    amount: number;
    date: string;
    fromAccountId: string;
    toAccountId: string;
  }) => Promise<void>;
}) {
  const [description, setDescription] = useState("Transferência");
  const [amount, setAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setFromAccountId((current) => (accounts.some((item) => item.id === current) ? current : accounts[0]?.id ?? ""));
    setToAccountId((current) => (accounts.some((item) => item.id === current) ? current : accounts[1]?.id ?? ""));
  }, [accounts]);

  const canSubmit = Boolean(description.trim() && amount && fromAccountId && toAccountId && fromAccountId !== toAccountId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    await onCreate({
      description: description.trim(),
      amount: Number(amount),
      date,
      fromAccountId,
      toAccountId
    });
    setAmount("");
  };

  return (
    <Card title="Cadastrar transferência">
      {accounts.length < 2 && (
        <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Cadastre pelo menos duas contas para fazer uma transferência.
        </p>
      )}
      <form className="grid gap-3 lg:grid-cols-5" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2" placeholder="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Valor" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
          <option value="">Conta de origem</option>
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
          <option value="">Conta de destino</option>
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-950 lg:col-span-3" disabled={!canSubmit} type="submit">
          Salvar transferência
        </button>
      </form>
    </Card>
  );
}

function CategoryForm({
  onSubmit,
  editingItem,
  onCancelEdit
}: {
  onSubmit: (data: Omit<Category, "id">) => Promise<void>;
  editingItem?: Category | null;
  onCancelEdit?: () => void;
}) {
  const [name, setName] = useState(editingItem?.name ?? "");
  const [type, setType] = useState<TransactionType>((editingItem?.type as TransactionType | null) ?? "EXPENSE");
  const [color, setColor] = useState(editingItem?.color ?? "#0F766E");

  useEffect(() => {
    setName(editingItem?.name ?? "");
    setType((editingItem?.type as TransactionType | null) ?? "EXPENSE");
    setColor(editingItem?.color ?? "#0F766E");
  }, [editingItem]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onSubmit({ name: name.trim(), color, icon: editingItem?.icon ?? "tag", type });
    setName("");
    onCancelEdit?.();
  };

  return (
    <Card title={editingItem ? "Editar categoria" : "Cadastrar categoria"}>
      <form className="grid gap-3 md:grid-cols-4" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm md:col-span-2" placeholder="Nome da categoria" value={name} onChange={(event) => setName(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
          <option value="INCOME">Receita</option>
          <option value="EXPENSE">Despesa</option>
        </select>
        <div className="flex gap-2">
          <input className="h-10 w-14 rounded-lg border border-slate-200 p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          <button className="h-10 flex-1 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-950" type="submit">
            {editingItem ? "Atualizar" : "Salvar"}
          </button>
        </div>
        {editingItem && (
          <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700 md:col-span-4" type="button" onClick={onCancelEdit}>
            Cancelar edição
          </button>
        )}
      </form>
    </Card>
  );
}

function AccountForm({
  onSubmit,
  editingItem,
  onCancelEdit
}: {
  onSubmit: (data: Omit<Account, "id">) => Promise<void>;
  editingItem?: Account | null;
  onCancelEdit?: () => void;
}) {
  const [name, setName] = useState(editingItem?.name ?? "");
  const [type, setType] = useState<Account["type"]>(editingItem?.type ?? "CHECKING");
  const [balance, setBalance] = useState(editingItem ? String(editingItem.balance) : "0");

  useEffect(() => {
    setName(editingItem?.name ?? "");
    setType(editingItem?.type ?? "CHECKING");
    setBalance(editingItem ? String(editingItem.balance) : "0");
  }, [editingItem]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onSubmit({ name: name.trim(), type, balance: Number(balance) });
    setName("");
    setBalance("0");
    onCancelEdit?.();
  };

  return (
    <Card title={editingItem ? "Editar conta" : "Cadastrar conta"}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm sm:col-span-2" placeholder="Nome da conta" value={name} onChange={(event) => setName(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as Account["type"])}>
          <option value="CHECKING">Conta corrente</option>
          <option value="SAVINGS">Poupança</option>
          <option value="WALLET">Carteira</option>
          <option value="INVESTMENT">Investimento</option>
        </select>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" type="number" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} />
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-950 sm:col-span-2" type="submit">
          {editingItem ? "Atualizar conta" : "Salvar conta"}
        </button>
        {editingItem && (
          <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700 sm:col-span-2" type="button" onClick={onCancelEdit}>
            Cancelar edição
          </button>
        )}
      </form>
    </Card>
  );
}

function CardForm({
  onSubmit,
  editingItem,
  onCancelEdit
}: {
  onSubmit: (data: Omit<CardType, "id">) => Promise<void>;
  editingItem?: CardType | null;
  onCancelEdit?: () => void;
}) {
  const [name, setName] = useState(editingItem?.name ?? "");
  const [brand, setBrand] = useState(editingItem?.brand ?? "");
  const [limit, setLimit] = useState(editingItem ? String(editingItem.limit) : "");
  const [closingDay, setClosingDay] = useState(editingItem ? String(editingItem.closingDay) : "20");
  const [dueDay, setDueDay] = useState(editingItem ? String(editingItem.dueDay) : "27");

  useEffect(() => {
    setName(editingItem?.name ?? "");
    setBrand(editingItem?.brand ?? "");
    setLimit(editingItem ? String(editingItem.limit) : "");
    setClosingDay(editingItem ? String(editingItem.closingDay) : "20");
    setDueDay(editingItem ? String(editingItem.dueDay) : "27");
  }, [editingItem]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !brand.trim() || !limit) return;
    await onSubmit({ name: name.trim(), brand: brand.trim(), limit: Number(limit), closingDay: Number(closingDay), dueDay: Number(dueDay) });
    setName("");
    setBrand("");
    setLimit("");
    onCancelEdit?.();
  };

  return (
    <Card title={editingItem ? "Editar cartão" : "Cadastrar cartão"}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Bandeira" value={brand} onChange={(event) => setBrand(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Limite" type="number" min="0" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" type="number" min="1" max="31" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
        </div>
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-950 sm:col-span-2" type="submit">
          {editingItem ? "Atualizar cartão" : "Salvar cartão"}
        </button>
        {editingItem && (
          <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700 sm:col-span-2" type="button" onClick={onCancelEdit}>
            Cancelar edição
          </button>
        )}
      </form>
    </Card>
  );
}

function RecurringForm({
  categories,
  accounts,
  onSubmit,
  editingItem,
  onCancelEdit
}: {
  categories: Category[];
  accounts: Account[];
  onSubmit: (data: Omit<RecurringExpense, "id">) => Promise<void>;
  editingItem?: RecurringExpense | null;
  onCancelEdit?: () => void;
}) {
  const expenseCategories = categories.filter((item) => item.type !== "INCOME");
  const [description, setDescription] = useState(editingItem?.description ?? "");
  const [amount, setAmount] = useState(editingItem ? String(editingItem.amount) : "");
  const [dueDay, setDueDay] = useState(editingItem ? String(editingItem.dueDay) : "5");
  const [categoryId, setCategoryId] = useState(editingItem?.categoryId ?? "");
  const [accountId, setAccountId] = useState(editingItem?.accountId ?? "");

  useEffect(() => {
    setDescription(editingItem?.description ?? "");
    setAmount(editingItem ? String(editingItem.amount) : "");
    setDueDay(editingItem ? String(editingItem.dueDay) : "5");
    setCategoryId(editingItem?.categoryId ?? expenseCategories[0]?.id ?? "");
    setAccountId(editingItem?.accountId ?? accounts[0]?.id ?? "");
  }, [accounts, editingItem, expenseCategories]);

  useEffect(() => {
    setCategoryId((current) => (expenseCategories.some((item) => item.id === current) ? current : expenseCategories[0]?.id ?? ""));
  }, [expenseCategories]);

  useEffect(() => {
    setAccountId((current) => (accounts.some((item) => item.id === current) ? current : accounts[0]?.id ?? ""));
  }, [accounts]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!description.trim() || !amount || !categoryId) return;
    await onSubmit({ description: description.trim(), amount: Number(amount), dueDay: Number(dueDay), categoryId, accountId: accountId || null, active: editingItem?.active ?? true });
    setDescription("");
    setAmount("");
    onCancelEdit?.();
  };

  return (
    <Card title={editingItem ? "Editar despesa fixa" : "Cadastrar fixa"}>
      {expenseCategories.length === 0 && <p className="mb-3 text-sm text-slate-500">Cadastre uma categoria de despesa antes.</p>}
      <form className="grid gap-3 lg:grid-cols-5" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2" placeholder="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Valor" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Categoria</option>
          {expenseCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Sem conta</option>
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-950 lg:col-span-3" disabled={!categoryId} type="submit">
          {editingItem ? "Atualizar fixa" : "Salvar fixa"}
        </button>
        {editingItem && (
          <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700 lg:col-span-2" type="button" onClick={onCancelEdit}>
            Cancelar edição
          </button>
        )}
      </form>
    </Card>
  );
}

function GoalForm({
  onSubmit,
  editingItem,
  onCancelEdit
}: {
  onSubmit: (data: Omit<Goal, "id">) => Promise<void>;
  editingItem?: Goal | null;
  onCancelEdit?: () => void;
}) {
  const [name, setName] = useState(editingItem?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(editingItem ? String(editingItem.targetAmount) : "");
  const [currentAmount, setCurrentAmount] = useState(editingItem ? String(editingItem.currentAmount) : "0");
  const [targetDate, setTargetDate] = useState(editingItem?.targetDate?.slice(0, 10) ?? "");
  const [type, setType] = useState<Goal["type"]>(editingItem?.type ?? "GOAL");

  useEffect(() => {
    setName(editingItem?.name ?? "");
    setTargetAmount(editingItem ? String(editingItem.targetAmount) : "");
    setCurrentAmount(editingItem ? String(editingItem.currentAmount) : "0");
    setTargetDate(editingItem?.targetDate?.slice(0, 10) ?? "");
    setType(editingItem?.type ?? "GOAL");
  }, [editingItem]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !targetAmount) return;
    await onSubmit({ name: name.trim(), targetAmount: Number(targetAmount), currentAmount: Number(currentAmount), targetDate: targetDate || null, type });
    setName("");
    setTargetAmount("");
    setCurrentAmount("0");
    setTargetDate("");
    onCancelEdit?.();
  };

  return (
    <Card title={editingItem ? "Editar meta" : "Cadastrar meta"}>
      <form className="grid gap-3 lg:grid-cols-5" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2" placeholder="Nome da meta" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Valor alvo" type="number" min="0" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Valor atual" type="number" min="0" step="0.01" value={currentAmount} onChange={(event) => setCurrentAmount(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as Goal["type"])}>
          <option value="GOAL">Meta</option>
          <option value="EMERGENCY_RESERVE">Reserva</option>
        </select>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-950 lg:col-span-3" type="submit">
          {editingItem ? "Atualizar meta" : "Salvar meta"}
        </button>
        {editingItem && (
          <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700 lg:col-span-2" type="button" onClick={onCancelEdit}>
            Cancelar edição
          </button>
        )}
      </form>
    </Card>
  );
}

function CategoriesView({
  categories,
  onCreate,
  onUpdate,
  onDelete
}: {
  categories: Category[];
  onCreate: (data: Omit<Category, "id">) => Promise<void>;
  onUpdate: (id: string, data: Omit<Category, "id">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Category | null>(null);
  const confirmDelete = async (item: Category) => {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    try {
      await onDelete(item.id);
    } catch (error) {
      reportActionError(error);
    }
  };

  return (
    <div className="space-y-5">
      <CategoryForm
        editingItem={editing}
        onCancelEdit={() => setEditing(null)}
        onSubmit={async (data) => {
          if (editing) await onUpdate(editing.id, data);
          else await onCreate(data);
          setEditing(null);
        }}
      />
      {categories.length === 0 ? (
        <Card><EmptyState message="Nenhuma categoria cadastrada ainda." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((item) => (
            <Card key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: item.color }} />
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.type === "INCOME" ? "Receita" : item.type === "EXPENSE" ? "Despesa" : "Geral"}</p>
                </div>
                </div>
                <RowActions onEdit={() => setEditing(item)} onDelete={() => confirmDelete(item)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountsView({
  accounts,
  cards,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateCard,
  onUpdateCard,
  onDeleteCard
}: {
  accounts: Account[];
  cards: CardType[];
  onCreateAccount: (data: Omit<Account, "id">) => Promise<void>;
  onUpdateAccount: (id: string, data: Omit<Account, "id">) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onCreateCard: (data: Omit<CardType, "id">) => Promise<void>;
  onUpdateCard: (id: string, data: Omit<CardType, "id">) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
}) {
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const confirmDeleteAccount = async (item: Account) => {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    try {
      await onDeleteAccount(item.id);
    } catch (error) {
      reportActionError(error);
    }
  };
  const confirmDeleteCard = async (item: CardType) => {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    try {
      await onDeleteCard(item.id);
    } catch (error) {
      reportActionError(error);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <AccountForm
          editingItem={editingAccount}
          onCancelEdit={() => setEditingAccount(null)}
          onSubmit={async (data) => {
            if (editingAccount) await onUpdateAccount(editingAccount.id, data);
            else await onCreateAccount(data);
            setEditingAccount(null);
          }}
        />
        <CardForm
          editingItem={editingCard}
          onCancelEdit={() => setEditingCard(null)}
          onSubmit={async (data) => {
            if (editingCard) await onUpdateCard(editingCard.id, data);
            else await onCreateCard(data);
            setEditingCard(null);
          }}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Contas">
        <div className="space-y-3">
          {accounts.length === 0 ? <EmptyState message="Nenhuma conta cadastrada ainda." /> : accounts.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-slate-500">{item.type}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold">{brl.format(item.balance)}</p>
                <RowActions onEdit={() => setEditingAccount(item)} onDelete={() => confirmDeleteAccount(item)} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Cartões">
        <div className="space-y-3">
          {cards.length === 0 ? <EmptyState message="Nenhum cartão cadastrado ainda." /> : cards.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <p className="font-medium">{item.name}</p>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-500">{item.brand}</p>
                  <RowActions onEdit={() => setEditingCard(item)} onDelete={() => confirmDeleteCard(item)} />
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">Limite {brl.format(item.limit)} | Vence dia {item.dueDay}</p>
            </div>
          ))}
        </div>
      </Card>
      </div>
    </div>
  );
}

function RecurringView({
  recurring,
  categories,
  accounts,
  onCreate,
  onUpdate,
  onDelete
}: {
  recurring: RecurringExpense[];
  categories: Category[];
  accounts: Account[];
  onCreate: (data: Omit<RecurringExpense, "id">) => Promise<void>;
  onUpdate: (id: string, data: Omit<RecurringExpense, "id">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const confirmDelete = async (item: RecurringExpense) => {
    if (!window.confirm(`Excluir "${item.description}"?`)) return;
    try {
      await onDelete(item.id);
    } catch (error) {
      reportActionError(error);
    }
  };

  return (
    <div className="space-y-5">
      <RecurringForm
        categories={categories}
        accounts={accounts}
        editingItem={editing}
        onCancelEdit={() => setEditing(null)}
        onSubmit={async (data) => {
          if (editing) await onUpdate(editing.id, data);
          else await onCreate(data);
          setEditing(null);
        }}
      />
      <Card title="Despesas fixas e recorrentes">
        {recurring.length === 0 ? <EmptyState message="Nenhuma despesa fixa cadastrada ainda." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {recurring.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.description}</p>
                <p className="text-sm text-slate-500">{categoryName(categories, item.categoryId)} | todo dia {item.dueDay}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{item.active ? "Ativa" : "Pausada"}</span>
                <RowActions onEdit={() => setEditing(item)} onDelete={() => confirmDelete(item)} />
              </div>
            </div>
            <p className="mt-4 text-xl font-semibold">{brl.format(item.amount)}</p>
          </div>
          ))}
        </div>
        )}
      </Card>
    </div>
  );
}

function GoalsView({
  goals,
  onCreate,
  onUpdate,
  onDelete
}: {
  goals: Goal[];
  onCreate: (data: Omit<Goal, "id">) => Promise<void>;
  onUpdate: (id: string, data: Omit<Goal, "id">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Goal | null>(null);
  const confirmDelete = async (item: Goal) => {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    try {
      await onDelete(item.id);
    } catch (error) {
      reportActionError(error);
    }
  };

  return (
    <div className="space-y-5">
      <GoalForm
        editingItem={editing}
        onCancelEdit={() => setEditing(null)}
        onSubmit={async (data) => {
          if (editing) await onUpdate(editing.id, data);
          else await onCreate(data);
          setEditing(null);
        }}
      />
      {goals.length === 0 ? <Card><EmptyState message="Nenhuma meta cadastrada ainda." /></Card> : (
      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((item) => {
        const progress = Math.min(100, Math.round((item.currentAmount / item.targetAmount) * 100));
        return (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.type === "EMERGENCY_RESERVE" ? "Reserva de emergência" : "Meta financeira"}</p>
              </div>
              <div className="flex items-center gap-3">
                {item.type === "EMERGENCY_RESERVE" ? <Flag size={20} className="text-emerald-700" /> : <Target size={20} className="text-blue-700" />}
                <RowActions onEdit={() => setEditing(item)} onDelete={() => confirmDelete(item)} />
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm">
                <span>{brl.format(item.currentAmount)}</span>
                <span>{brl.format(item.targetAmount)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{progress}% concluído</p>
            </div>
          </Card>
        );
        })}
      </div>
      )}
    </div>
  );
}
