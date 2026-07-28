# Financas Pessoais

App full stack para controle de financas pessoais.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Recharts
- Node.js + Express
- Prisma + PostgreSQL

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Configure o banco em `apps/api/.env`:

```bash
DATABASE_URL="postgresql://usuario:senha@localhost:5432/financas_pessoais?schema=public"
PORT=3333
```

3. Gere o Prisma Client e rode a migracao:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

4. Inicie frontend e backend:

```bash
npm run dev
```

Frontend: http://localhost:5180

API: http://localhost:3333
