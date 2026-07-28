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
  CreditCard,
  Filter,
  Flag,
  LayoutDashboard,
  LogOut,
  Plus,
  ReceiptText,
  Tags,
  Target,
  WalletCards
} from "lucide-react";
import type { Account, Card as CardType, Category, DashboardSummary, Goal, RecurringExpense, Transaction, TransactionType } from "@financas/shared";
import { Card } from "./components/Card";
import { api, emptyDashboard, setAccessTokenProvider } from "./lib/api";
import { brl, formatDate, monthLabel } from "./lib/format";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type View = "dashboard" | "transactions" | "categories" | "accounts" | "recurring" | "charts" | "goals";

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transactions", label: "Lancamentos", icon: ReceiptText },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "accounts", label: "Contas", icon: CreditCard },
  { id: "recurring", label: "Fixas", icon: CalendarDays },
  { id: "charts", label: "Graficos", icon: ChartNoAxesCombined },
  { id: "goals", label: "Metas", icon: Target }
];

const categoryName = (categories: Category[], id: string) => categories.find((item) => item.id === id)?.name ?? "Sem categoria";

const currentMonth = "2026-07";

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
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar lancamentos");
      });
  }, [month, type, categoryId, session]);

  const expenseCategories = useMemo(() => categories.filter((item) => item.type !== "INCOME"), [categories]);

  const stats = [
    { label: "Saldo atual", value: dashboard?.currentBalance ?? 0, icon: WalletCards, tone: "text-slate-900" },
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

  const createCategory = async (data: Omit<Category, "id">) => {
    const created = await api.createCategory(data);
    setCategories((current) => [created, ...current]);
  };

  const createAccount = async (data: Omit<Account, "id">) => {
    const created = await api.createAccount(data);
    setAccounts((current) => [created, ...current]);
    await refreshDashboard();
  };

  const createCard = async (data: Omit<CardType, "id">) => {
    const created = await api.createCard(data);
    setCards((current) => [created, ...current]);
  };

  const createRecurringExpense = async (data: Omit<RecurringExpense, "id">) => {
    const created = await api.createRecurringExpense(data);
    setRecurring((current) => [created, ...current]);
  };

  const createGoal = async (data: Omit<Goal, "id">) => {
    const created = await api.createGoal(data);
    setGoals((current) => [created, ...current]);
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  if (!isSupabaseConfigured) {
    return <AuthSetupMissing />;
  }

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-4 text-slate-700">
        <p className="text-sm font-medium">Carregando autenticacao...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-paper text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-white">
            <WalletCards size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold">Financas Pessoais</p>
            <p className="text-xs text-slate-500">Controle simples</p>
          </div>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                view === item.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-paper/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Julho de 2026</p>
              <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{navItems.find((item) => item.id === view)?.label}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
              />
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white">
                <Plus size={16} />
                Novo
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
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
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
                        <p className="text-sm text-slate-500">{item.label}</p>
                        <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{brl.format(item.value)}</p>
                      </div>
                      <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-slate-700">
                        <item.icon size={21} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
                <MonthlyChart data={dashboard?.monthly ?? []} />
                <CategoryPie data={dashboard?.byCategory ?? []} />
              </div>
              <TransactionsTable transactions={transactions.slice(0, 5)} categories={categories} title="Ultimos lancamentos" />
            </div>
          )}

          {view === "transactions" && (
            <div className="space-y-5">
              <Card title="Filtros" action={<Filter size={18} className="text-slate-500" />}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={type} onChange={(event) => setType(event.target.value)}>
                    <option value="">Todos os tipos</option>
                    <option value="INCOME">Receitas</option>
                    <option value="EXPENSE">Despesas</option>
                  </select>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">Todas as categorias</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <button className="h-10 rounded-lg border border-slate-200 text-sm font-medium" onClick={() => { setType(""); setCategoryId(""); }}>
                    Limpar filtros
                  </button>
                </div>
              </Card>
              <TransactionForm categories={categories} accounts={accounts} cards={cards} onCreate={createTransaction} />
              <TransactionsTable transactions={transactions} categories={categories} title="Lancamentos do mes" />
            </div>
          )}

          {view === "categories" && <CategoriesView categories={categories} onCreate={createCategory} />}
          {view === "accounts" && (
            <AccountsView accounts={accounts} cards={cards} onCreateAccount={createAccount} onCreateCard={createCard} />
          )}
          {view === "recurring" && (
            <RecurringView recurring={recurring} categories={categories} accounts={accounts} onCreate={createRecurringExpense} />
          )}
          {view === "charts" && (
            <div className="grid gap-5 xl:grid-cols-2">
              <MonthlyChart data={dashboard?.monthly ?? []} />
              <CategoryPie data={dashboard?.byCategory ?? []} />
            </div>
          )}
          {view === "goals" && <GoalsView goals={goals} onCreate={createGoal} />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-7 border-t border-slate-200 bg-white px-2 py-2 lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] ${view === item.id ? "text-slate-950" : "text-slate-500"}`}
            aria-label={item.label}
          >
            <item.icon size={18} />
            <span className="hidden min-[430px]:inline">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function AuthSetupMissing() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <Card title="Supabase nao configurado">
        <div className="max-w-lg space-y-3 text-sm text-slate-600">
          <p>Crie o arquivo apps/web/.env.local com as variaveis abaixo e reinicie o servidor do frontend.</p>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-white">
            VITE_SUPABASE_URL="https://seu-projeto.supabase.co"{`\n`}
            VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-publicavel"
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
      setMessage("Cadastro criado. Verifique seu email se a confirmacao estiver ativa no Supabase.");
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
            <p className="text-sm font-semibold text-slate-950">Financas Pessoais</p>
            <p className="text-xs text-slate-500">Acesse sua area protegida</p>
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

            {message && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}

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
            {mode === "signin" ? "Criar uma conta" : "Ja tenho conta"}
          </button>
        </Card>
      </div>
    </div>
  );
}

function MonthlyChart({ data }: { data: DashboardSummary["monthly"] }) {
  return (
    <Card title="Evolucao mensal">
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
  onCreate
}: {
  categories: Category[];
  accounts: Account[];
  cards: CardType[];
  onCreate: (data: Omit<Transaction, "id">) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const availableCategories = categories.filter((item) => !item.type || item.type === transactionType);

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
    if (!description.trim() || !amount || !selectedCategoryId) return;
    await onCreate({
      description: description.trim(),
      amount: Number(amount),
      type: transactionType,
      date,
      categoryId: selectedCategoryId,
      accountId: selectedAccountId || null,
      cardId: selectedCardId || null,
      isRecurring: false
    });
    setDescription("");
    setAmount("");
  };

  const canSubmit = Boolean(description.trim() && amount && selectedCategoryId);

  return (
    <Card title="Cadastrar receita ou despesa">
      {categories.length === 0 && (
        <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Cadastre uma categoria antes de adicionar lancamentos.
        </p>
      )}
      <form className="grid gap-3 lg:grid-cols-6" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2" placeholder="Descricao" value={description} onChange={(event) => setDescription(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Valor" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={transactionType} onChange={(event) => setTransactionType(event.target.value as "INCOME" | "EXPENSE")}>
          <option value="INCOME">Receita</option>
          <option value="EXPENSE">Despesa</option>
        </select>
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
          <option value="">Selecione uma categoria</option>
          {availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2" value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)}>
          <option value="">Sem cartao</option>
          {cards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50 lg:col-span-2" disabled={!canSubmit}>Salvar lancamento</button>
      </form>
    </Card>
  );
}

function TransactionsTable({ transactions, categories, title }: { transactions: Transaction[]; categories: Category[]; title: string }) {
  return (
    <Card title={title}>
      {transactions.length === 0 ? (
        <EmptyState message="Nenhum lancamento cadastrado ainda." />
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="pb-3">Descricao</th>
              <th className="pb-3">Categoria</th>
              <th className="pb-3">Data</th>
              <th className="pb-3">Tipo</th>
              <th className="pb-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((item) => (
              <tr key={item.id}>
                <td className="py-3 font-medium text-slate-900">{item.description}</td>
                <td className="py-3 text-slate-600">{categoryName(categories, item.categoryId)}</td>
                <td className="py-3 text-slate-600">{formatDate(item.date)}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${item.type === "INCOME" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {item.type === "INCOME" ? "Receita" : "Despesa"}
                  </span>
                </td>
                <td className={`py-3 text-right font-semibold ${item.type === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
                  {item.type === "INCOME" ? "+" : "-"} {brl.format(item.amount)}
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

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{message}</p>;
}

function CategoryForm({ onCreate }: { onCreate: (data: Omit<Category, "id">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [color, setColor] = useState("#0F766E");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate({ name: name.trim(), color, icon: "tag", type });
    setName("");
  };

  return (
    <Card title="Cadastrar categoria">
      <form className="grid gap-3 md:grid-cols-4" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm md:col-span-2" placeholder="Nome da categoria" value={name} onChange={(event) => setName(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
          <option value="INCOME">Receita</option>
          <option value="EXPENSE">Despesa</option>
        </select>
        <div className="flex gap-2">
          <input className="h-10 w-14 rounded-lg border border-slate-200 p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          <button className="h-10 flex-1 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white" type="submit">Salvar</button>
        </div>
      </form>
    </Card>
  );
}

function AccountForm({ onCreate }: { onCreate: (data: Omit<Account, "id">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("CHECKING");
  const [balance, setBalance] = useState("0");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate({ name: name.trim(), type, balance: Number(balance) });
    setName("");
    setBalance("0");
  };

  return (
    <Card title="Cadastrar conta">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm sm:col-span-2" placeholder="Nome da conta" value={name} onChange={(event) => setName(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as Account["type"])}>
          <option value="CHECKING">Conta corrente</option>
          <option value="SAVINGS">Poupanca</option>
          <option value="WALLET">Carteira</option>
          <option value="INVESTMENT">Investimento</option>
        </select>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" type="number" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} />
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white sm:col-span-2" type="submit">Salvar conta</button>
      </form>
    </Card>
  );
}

function CardForm({ onCreate }: { onCreate: (data: Omit<CardType, "id">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("20");
  const [dueDay, setDueDay] = useState("27");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !brand.trim() || !limit) return;
    await onCreate({ name: name.trim(), brand: brand.trim(), limit: Number(limit), closingDay: Number(closingDay), dueDay: Number(dueDay) });
    setName("");
    setBrand("");
    setLimit("");
  };

  return (
    <Card title="Cadastrar cartao">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Bandeira" value={brand} onChange={(event) => setBrand(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Limite" type="number" min="0" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" type="number" min="1" max="31" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
        </div>
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white sm:col-span-2" type="submit">Salvar cartao</button>
      </form>
    </Card>
  );
}

function RecurringForm({
  categories,
  accounts,
  onCreate
}: {
  categories: Category[];
  accounts: Account[];
  onCreate: (data: Omit<RecurringExpense, "id">) => Promise<void>;
}) {
  const expenseCategories = categories.filter((item) => item.type !== "INCOME");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("5");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    setCategoryId((current) => (expenseCategories.some((item) => item.id === current) ? current : expenseCategories[0]?.id ?? ""));
  }, [expenseCategories]);

  useEffect(() => {
    setAccountId((current) => (accounts.some((item) => item.id === current) ? current : accounts[0]?.id ?? ""));
  }, [accounts]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!description.trim() || !amount || !categoryId) return;
    await onCreate({ description: description.trim(), amount: Number(amount), dueDay: Number(dueDay), categoryId, accountId: accountId || null, active: true });
    setDescription("");
    setAmount("");
  };

  return (
    <Card title="Cadastrar fixa">
      {expenseCategories.length === 0 && <p className="mb-3 text-sm text-slate-500">Cadastre uma categoria de despesa antes.</p>}
      <form className="grid gap-3 lg:grid-cols-5" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2" placeholder="Descricao" value={description} onChange={(event) => setDescription(event.target.value)} />
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
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50 lg:col-span-3" disabled={!categoryId} type="submit">Salvar fixa</button>
      </form>
    </Card>
  );
}

function GoalForm({ onCreate }: { onCreate: (data: Omit<Goal, "id">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [type, setType] = useState<Goal["type"]>("GOAL");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !targetAmount) return;
    await onCreate({ name: name.trim(), targetAmount: Number(targetAmount), currentAmount: Number(currentAmount), targetDate: targetDate || null, type });
    setName("");
    setTargetAmount("");
    setCurrentAmount("0");
    setTargetDate("");
  };

  return (
    <Card title="Cadastrar meta">
      <form className="grid gap-3 lg:grid-cols-5" onSubmit={submit}>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2" placeholder="Nome da meta" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Valor alvo" type="number" min="0" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} />
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Valor atual" type="number" min="0" step="0.01" value={currentAmount} onChange={(event) => setCurrentAmount(event.target.value)} />
        <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as Goal["type"])}>
          <option value="GOAL">Meta</option>
          <option value="EMERGENCY_RESERVE">Reserva</option>
        </select>
        <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white lg:col-span-3" type="submit">Salvar meta</button>
      </form>
    </Card>
  );
}

function CategoriesView({ categories, onCreate }: { categories: Category[]; onCreate: (data: Omit<Category, "id">) => Promise<void> }) {
  return (
    <div className="space-y-5">
      <CategoryForm onCreate={onCreate} />
      {categories.length === 0 ? (
        <Card><EmptyState message="Nenhuma categoria cadastrada ainda." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((item) => (
            <Card key={item.id}>
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: item.color }} />
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.type === "INCOME" ? "Receita" : item.type === "EXPENSE" ? "Despesa" : "Geral"}</p>
                </div>
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
  onCreateCard
}: {
  accounts: Account[];
  cards: CardType[];
  onCreateAccount: (data: Omit<Account, "id">) => Promise<void>;
  onCreateCard: (data: Omit<CardType, "id">) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <AccountForm onCreate={onCreateAccount} />
        <CardForm onCreate={onCreateCard} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Contas">
        <div className="space-y-3">
          {accounts.length === 0 ? <EmptyState message="Nenhuma conta cadastrada ainda." /> : accounts.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-slate-500">{item.type}</p>
              </div>
              <p className="font-semibold">{brl.format(item.balance)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Cartoes">
        <div className="space-y-3">
          {cards.length === 0 ? <EmptyState message="Nenhum cartao cadastrado ainda." /> : cards.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-slate-500">{item.brand}</p>
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
  onCreate
}: {
  recurring: RecurringExpense[];
  categories: Category[];
  accounts: Account[];
  onCreate: (data: Omit<RecurringExpense, "id">) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <RecurringForm categories={categories} accounts={accounts} onCreate={onCreate} />
      <Card title="Despesas fixas e recorrentes">
        {recurring.length === 0 ? <EmptyState message="Nenhuma despesa fixa cadastrada ainda." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {recurring.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.description}</p>
                <p className="text-sm text-slate-500">{categoryName(categories, item.categoryId)} | todo dia {item.dueDay}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{item.active ? "Ativa" : "Pausada"}</span>
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

function GoalsView({ goals, onCreate }: { goals: Goal[]; onCreate: (data: Omit<Goal, "id">) => Promise<void> }) {
  return (
    <div className="space-y-5">
      <GoalForm onCreate={onCreate} />
      {goals.length === 0 ? <Card><EmptyState message="Nenhuma meta cadastrada ainda." /></Card> : (
      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((item) => {
        const progress = Math.min(100, Math.round((item.currentAmount / item.targetAmount) * 100));
        return (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-slate-500">{item.type === "EMERGENCY_RESERVE" ? "Reserva de emergencia" : "Meta financeira"}</p>
              </div>
              {item.type === "EMERGENCY_RESERVE" ? <Flag size={20} className="text-emerald-700" /> : <Target size={20} className="text-blue-700" />}
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm">
                <span>{brl.format(item.currentAmount)}</span>
                <span>{brl.format(item.targetAmount)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-500">{progress}% concluido</p>
            </div>
          </Card>
        );
        })}
      </div>
      )}
    </div>
  );
}
