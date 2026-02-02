<h1 align="center">Open-source Prediction Market</h1>

<p align="center">
  Have your own on-chain Web3 prediction market stack inspired by Polymarket.
  Transparent, open source, and early-stage.
</p>
<p align="center"> [
  <a href="https://kuest.com">Demo</a>
  • <a href="#why-kuest">About</a>
  • <a href="#quick-start-15-minutes">Installation</a>
  • <a href="#roadmap">Roadmap</a> ]
</p>

<p align="center">
  <a href="https://kuest.com">
    <img src="https://i.imgur.com/q1edYP5.png" alt="Kuest" />
  </a>
</p>

## Why Kuest

- Launch your own on-chain prediction market in minutes.
- Earn fees on trades with a transparent, open-source stack.
- Built-in affiliate links so partners can promote your fork and grow volume.
- Polygon-native for low fees and high-speed settlement.
- UMA resolves outcomes with public, verifiable oracles.
- Full web UI plus bot-ready APIs and SDKs (Python/Rust) . No backend infra to manage.
- Same USDC on Polygon — plug‑and‑play for Polymarket users.

<p>
  <img src="https://kuest.theproxies.workers.dev/kuest-stack-polymarket.svg" height="52" alt="Polymarket" />
  <img src="https://kuest.theproxies.workers.dev/kuest-stack-kalshi.svg" height="52" alt="Kalshi (soon)" />
</p>

> [!TIP]
> Want your own Polymarket-style venue? Launch fast with your brand, rules, and fees. Arbitrage flows are live (Kalshi connector soon) and bot SDKs are ready today — see [kuestcom on GitHub](https://github.com/kuestcom).

## Core Web3 Stack

<p align="center">
  <img src="https://kuest.theproxies.workers.dev/kuest-stack-polygon.svg" height="42" alt="Polygon" />
  <img src="https://kuest.theproxies.workers.dev/kuest-stack-usdc.svg" height="42" alt="USDC" />
  <img src="https://kuest.theproxies.workers.dev/kuest-stack-uma.svg" height="42" alt="UMA" />
</p>
<p align="center">
  <img src="https://kuest.theproxies.workers.dev/kuest-stack-gnosis-safe-wallet.svg" height="42" alt="Safe (Gnosis)" />
  <img src="https://kuest.theproxies.workers.dev/kuest-stack-reown.svg" height="42" alt="Reown" />
  <img src="https://kuest.theproxies.workers.dev/kuest-stack-better-auth.svg" height="42" alt="Better Auth" />
  <img src="https://kuest.theproxies.workers.dev/kuest-stack-wevm.svg" height="42" alt="wevm (wagmi/viem)" />
</p>

## Quick Start (15 minutes)

> [!NOTE]
> **Get Started Now!**
> Follow these simple steps to launch your own prediction market:
> <p>
>   <img src="https://kuest.theproxies.workers.dev/kuest-stack-vercel.svg" height="42" alt="Vercel" />
>   <img src="https://kuest.theproxies.workers.dev/kuest-stack-nextjs.svg" height="42" alt="Next.js" />
>   <img src="https://kuest.theproxies.workers.dev/kuest-stack-typescript.svg" height="42" alt="TypeScript" />
>   <img src="https://kuest.theproxies.workers.dev/kuest-stack-supabase.svg" height="42" alt="Supabase" />
> </p>
>
> ### 1. Fork the Repository
> Click the **Fork** button in the top right corner (and feel free to leave a **⭐ star**!)
> ### 2. Create a New Project on Vercel
> 1. Go to [Vercel](https://vercel.com) dashboard
> 2. Select **Add New** → **Project**
> 3. Connect your **GitHub account**
> 4. Import and Deploy your **forked repository**
>
> *Note: The initial deployment may fail due to missing environment variables. This is expected.
> Complete Step 3 (Supabase) and Step 4 (environment) first, then redeploy from your project dashboard.*
> ### 3. Create Database (Supabase)
> 1. Go to your project dashboard
> 2. Navigate to the **Storage** tab
> 3. Find **Supabase** in the database list and click **Create**
> 4. Keep all default settings and click **Create** in the final step
> 5. Once ready, click the **Connect Project** button to link to your project
> ### 4. Configure Your Environment
> 1. **Download** the `.env.example` file from this repository
> 2. **Edit** it with your configuration:
>    - **Kuest CLOB Ordersbook**: Connect your wallet at [auth.kuest.com](https://auth.kuest.com), sign to verify ownership, and copy the API key, secret, and passphrase
>    - **Reown AppKit**: Get Project ID at [dashboard.reown.com](https://dashboard.reown.com)
>    - **Better Auth**: Generate secret at [better-auth.com](https://www.better-auth.com/docs/installation#set-environment-variables)
>    - **CRON_SECRET**: Create a random secret of at least 16 characters
> 3. Go to your Vercel project dashboard
> 4. Navigate to **Settings** → **Environment Variables**
> 5. Click **"Import .env"** button
> 6. Select your edited `.env.example` file
> ### 5. Redeploy your project
> *Optionally, add your custom domain in **Settings** → **Domains** on your project dashboard.*
> ### 6. Sync Your Fork (via GitHub Actions)
> In your forked Kuest repository:
> 1. Go to **Settings** → **Actions** → **General**
> 2. Select **"Allow all actions and reusable workflows"**
> 3. Click **Save** - This enables automatic sync with the main repository

**Ready! 🎉** Your prediction market will be online with automatic database setup in a few minutes.

## Roadmap

- [x] Polymarket-inspired UI and market pages
- [x] Polygon network support
- [x] Wallet onboarding via Reown AppKit
- [x] Safe-compatible proxy wallet flows
- [x] Relayer server
- [x] Matching engine
- [x] Split and Merge functions
- [x] PnL system
- [x] Negative Risk Conversion Positions function
- [x] Public bot SDK (Python/Rust)
- [ ] UMA Oracle implementation
- [ ] 🏆 MVP Ready (stress tests, security and calculation checks)
- [ ] Move matching engine to mainnet
- [ ] Traders Ranking (soon)
- [ ] Auto‑renew Crypto and X counter markets (soon)
- [ ] Sports markets (soon)
- [ ] User-created markets (soon)
- [ ] Kalshi arbitrage connector (soon)

## Follow Us

<p>
  <a href="https://discord.gg/kuest">
    <img alt="Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&style=social" />
  </a>
  <a href="https://x.com/kuest">
    <img alt="X" src="https://img.shields.io/badge/X-@kuest-000?logo=x&style=social" />
  </a>
  <a href="mailto:hello@kuest.com">
    <img alt="Email" src="https://img.shields.io/badge/Email-hello%40kuest.com-444?logo=gmail&style=social" />
  </a>
  <a href="https://kuest.com">
    <img alt="Website" src="https://img.shields.io/badge/Website-kuest.com-111?logo=website&style=social" />
  </a>
</p>

---

License: [Kuest MIT+Commons](LICENSE).
