DELETE FROM public."Transaction";
DELETE FROM public."RecurringExpense";
DELETE FROM public."Goal";
DELETE FROM public."Card";
DELETE FROM public."Account";
DELETE FROM public."Category";

ALTER TABLE public."Category" ADD COLUMN "userId" TEXT NOT NULL;
ALTER TABLE public."Account" ADD COLUMN "userId" TEXT NOT NULL;
ALTER TABLE public."Card" ADD COLUMN "userId" TEXT NOT NULL;
ALTER TABLE public."Transaction" ADD COLUMN "userId" TEXT NOT NULL;
ALTER TABLE public."RecurringExpense" ADD COLUMN "userId" TEXT NOT NULL;
ALTER TABLE public."Goal" ADD COLUMN "userId" TEXT NOT NULL;

CREATE INDEX "Category_userId_idx" ON public."Category" ("userId");
CREATE INDEX "Account_userId_idx" ON public."Account" ("userId");
CREATE INDEX "Card_userId_idx" ON public."Card" ("userId");
CREATE INDEX "Transaction_userId_idx" ON public."Transaction" ("userId");
CREATE INDEX "RecurringExpense_userId_idx" ON public."RecurringExpense" ("userId");
CREATE INDEX "Goal_userId_idx" ON public."Goal" ("userId");
