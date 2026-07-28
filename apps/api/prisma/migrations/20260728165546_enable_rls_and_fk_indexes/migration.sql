ALTER TABLE public."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Card" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Goal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecurringExpense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Transaction" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "RecurringExpense_accountId_idx" ON public."RecurringExpense" ("accountId");
CREATE INDEX IF NOT EXISTS "RecurringExpense_categoryId_idx" ON public."RecurringExpense" ("categoryId");
CREATE INDEX IF NOT EXISTS "Transaction_accountId_idx" ON public."Transaction" ("accountId");
CREATE INDEX IF NOT EXISTS "Transaction_cardId_idx" ON public."Transaction" ("cardId");
CREATE INDEX IF NOT EXISTS "Transaction_categoryId_idx" ON public."Transaction" ("categoryId");
