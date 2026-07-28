# Financas Pessoais

App full stack para controle de financas pessoais.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Recharts
- Node.js + Express
- Prisma + PostgreSQL
- Supabase Auth

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Configure o banco em `apps/api/.env`:

```bash
DATABASE_URL="postgresql://usuario:senha@localhost:5432/financas_pessoais?schema=public"
PORT=3333
SUPABASE_URL="https://nmgksbiafdpokaxljiqg.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sua-chave-publicavel"
```

3. Configure o Auth do Supabase em `apps/web/.env.local`:

```bash
VITE_SUPABASE_URL="https://nmgksbiafdpokaxljiqg.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-publicavel"
```

A `SUPABASE_PUBLISHABLE_KEY` fica no painel do Supabase em Project Settings > API Keys. Use a chave publica. Nao use `service_role` no frontend.

4. Gere o Prisma Client e rode a migracao:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

5. Inicie frontend e backend:

```bash
npm run dev
```

Frontend: http://localhost:5180

API: http://localhost:3333
