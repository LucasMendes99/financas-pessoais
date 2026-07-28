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

## Deploy no Render

No Render, configure `DATABASE_URL` usando o pooler IPv4 do Supabase, nao a URL direta `db...supabase.co:5432`.

Formato:

```bash
DATABASE_URL="postgresql://postgres.nmgksbiafdpokaxljiqg:SENHA_DO_BANCO@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?schema=public"
```

Use a senha do banco do Supabase no lugar de `SENHA_DO_BANCO`. Se a senha tiver caracteres especiais, use a connection string copiada em **Supabase > Connect > Session pooler** para evitar erro de escape.
