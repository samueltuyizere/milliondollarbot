import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database…");

  // Create admin user
  const hash = await bcrypt.hash("admin1234", 12);
  const user = await prisma.user.upsert({
    where: { email: "admin@aitrader.local" },
    update: {},
    create: {
      email: "admin@aitrader.local",
      name: "Trader",
      passwordHash: hash,
      role: "ADMIN",
    },
  });
  console.log(`User: ${user.email}`);

  // Create funded account
  const account = await prisma.account.upsert({
    where: { id: "acc_phase1" },
    update: {},
    create: {
      id: "acc_phase1",
      name: "FundedNext Phase 1",
      broker: "FundedNext",
      balance: 500000,
      drawdownLimit: 5.0,
      dailyLossLimit: 1.0,
      isActive: true,
      phase: "Phase 1",
    },
  });
  console.log(`Account: ${account.name}`);

  // Create bot config
  const botConfig = await prisma.botConfig.upsert({
    where: { accountId: "acc_phase1" },
    update: {},
    create: {
      accountId: "acc_phase1",
      symbol: "XAUUSD",
      isRunning: false,
      isPaused: false,
      longOnly: true,
      sessionStart: "08:00",
      sessionEnd: "17:00",
    },
  });
  console.log(`Bot config created for ${botConfig.symbol}`);

  // Create strategy config
  await prisma.strategyConfig.upsert({
    where: { botConfigId: botConfig.id },
    update: {},
    create: {
      botConfigId: botConfig.id,
      emaFast: 21,
      emaSlow: 50,
      rsiPeriod: 14,
      rsiOversold: 40,
      atrPeriod: 14,
      atrMultiSl: 1.5,
      timeframe: "H1",
    },
  });
  console.log("Strategy config created");

  // Create risk rules
  await prisma.riskRules.upsert({
    where: { botConfigId: botConfig.id },
    update: {},
    create: {
      botConfigId: botConfig.id,
      riskPerTradePct: 0.25,
      maxDailyLossPct: 1.0,
      maxDrawdownPct: 4.5,
      minRR: 2.0,
      maxOpenTrades: 1,
      dailyLockActive: false,
    },
  });
  console.log("Risk rules created");

  // Create initial bot status
  const existing = await prisma.botStatus.findFirst();
  if (!existing) {
    await prisma.botStatus.create({
      data: { status: "STOPPED", openTrades: 0, dailyPnl: 0, drawdownPct: 0 },
    });
    console.log("Bot status initialized");
  }

  console.log("\nSeed complete!");
  console.log("Login: admin@aitrader.local / admin1234");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
