# Chronicle — Goku Studio Timesheet

Internal timesheet management tool for Goku Studio. Track tasks, meetings, and billable hours across clients and projects.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.local` and fill in the values:

```bash
cp .env.local .env.local
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret for JWT (run: `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Base URL of the app (e.g. `https://yourapp.vercel.app`) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Cloud API phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Cloud API access token |
| `WHATSAPP_VERIFY_TOKEN` | Custom token you choose for webhook verification |
| `AI_PROVIDER` | `gemini` (default), `claude`, or `openai` |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `NEXT_PUBLIC_APP_URL` | Public URL (same as `NEXTAUTH_URL`) |

### 3. Connect Neon Database

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the **Connection string** from the dashboard
4. Paste it as `DATABASE_URL` in `.env.local`

### 4. Run database migrations

```bash
npx prisma migrate dev --name init
```

### 5. Seed initial data

```bash
npx prisma db seed
```

This creates:
- Default admin user (`admin` / `goku2026`)
- Clients: Appasamy, Goku Studio
- Projects for each client
- 6 team members

### 6. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to login.

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add all environment variables from `.env.local` in the Vercel dashboard
4. Deploy

**Important:** Set `NEXTAUTH_URL` to your Vercel deployment URL (e.g. `https://chronicle.vercel.app`)

After deploy, run migrations against your Neon DB:

```bash
DATABASE_URL="your-neon-url" npx prisma migrate deploy
DATABASE_URL="your-neon-url" npx prisma db seed
```

---

## WhatsApp Bot Setup

1. Create a Meta Developer app at [developers.facebook.com](https://developers.facebook.com)
2. Add the **WhatsApp** product to your app
3. Under WhatsApp → Configuration, set the webhook URL to:
   `https://yourapp.vercel.app/api/whatsapp`
4. Set the **Verify Token** to match `WHATSAPP_VERIFY_TOKEN` in your env
5. Subscribe to the `messages` webhook field
6. Add team members' WhatsApp numbers in Settings → Team Members

---

## Default Login

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `goku2026` |

Change your password at Settings → Account.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Neon PostgreSQL via Prisma ORM
- **Auth:** NextAuth v5 (credentials)
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Export:** ExcelJS
- **AI/OCR:** Gemini 1.5 Flash (default)
