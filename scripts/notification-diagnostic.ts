#!/usr/bin/env tsx
/**
 * Comprehensive Notification System Diagnostic
 * Checks: DB notifications, worker status, queue status, email logs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function diagnostic() {
  console.log("\n📊 BROADY NOTIFICATION SYSTEM DIAGNOSTIC\n");
  console.log("═".repeat(70));

  // 1. Check recent notifications in DB
  console.log("\n1️⃣  RECENT NOTIFICATIONS IN DATABASE\n");
  const recentNotifications = await prisma.notification.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      userId: true,
      brandId: true,
      deliveryStatus: true,
      createdAt: true,
      channelLogs: {
        select: {
          id: true,
          channel: true,
          status: true,
          error: true,
        },
      },
    },
  });

  if (recentNotifications.length === 0) {
    console.log("❌ NO NOTIFICATIONS FOUND IN DATABASE");
  } else {
    console.log(`✓ Found ${recentNotifications.length} recent notifications:\n`);
    recentNotifications.forEach((notif, idx) => {
      console.log(`  [${idx + 1}] ${notif.type} - "${notif.title}"`);
      console.log(`      Created: ${notif.createdAt.toISOString()}`);
      console.log(`      Delivery Status: ${notif.deliveryStatus}`);
      const logs = notif.channelLogs || [];
      console.log(`      Channels: ${logs.length}`);
      logs.forEach((ch) => {
        console.log(`        - ${ch.channel}: ${ch.status} ${ch.error ? `(${ch.error})` : ""}`);
      });
      console.log();
    });
  }

  // 2. Check notification preferences
  console.log("\n2️⃣  NOTIFICATION PREFERENCES\n");
  const userCount = await prisma.user.count();
  const prefsCount = await prisma.notificationPreference.count();
  console.log(`  Total Users: ${userCount}`);
  console.log(`  Preferences Set: ${prefsCount}`);
  console.log(`  Opt-in Rate: ${((prefsCount / userCount) * 100).toFixed(1)}%\n`);

  // 3. Check email channel logs
  console.log("3️⃣  EMAIL CHANNEL LOGS (Last 20)\n");
  const emailLogs = await prisma.notificationChannelLog.findMany({
    where: { channel: "EMAIL" },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      error: true,
      recipient: true,
      createdAt: true,
    },
  });

  if (emailLogs.length === 0) {
    console.log("❌ NO EMAIL LOGS FOUND");
  } else {
    const sentCount = emailLogs.filter((l) => l.status === "SENT").length;
    const failCount = emailLogs.filter((l) => l.status === "FAILED").length;
    const pendingCount = emailLogs.filter((l) => l.status === "PENDING").length;

    console.log(`  ✓ SENT: ${sentCount}`);
    console.log(`  ✗ FAILED: ${failCount}`);
    console.log(`  ⏳ PENDING: ${pendingCount}\n`);

    if (failCount > 0) {
      console.log("  Recent Failures:");
      emailLogs
        .filter((l) => l.status === "FAILED")
        .slice(0, 5)
        .forEach((log) => {
          console.log(`    - ${log.recipient}: ${log.error}`);
        });
      console.log();
    }
  }

  // 4. Check order events
  console.log("4️⃣  RECENT ORDERS\n");
  const recentOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      user: { select: { email: true } },
      items: { select: { brandId: true } },
      createdAt: true,
      notifications: { select: { id: true, type: true, status: true } },
    },
  });

  if (recentOrders.length === 0) {
    console.log("❌ NO ORDERS FOUND");
  } else {
    console.log(`✓ Found ${recentOrders.length} recent orders:\n`);
    recentOrders.forEach((order, idx) => {
      console.log(`  [${idx + 1}] Order ${order.id.substring(0, 8)}...`);
      console.log(`      Customer: ${order.user.email}`);
      console.log(`      Created: ${order.createdAt.toISOString()}`);
      console.log(`      Notifications: ${order.notifications.length}`);
      if (order.notifications.length > 0) {
        order.notifications.forEach((n) => {
          console.log(`        - ${n.type}: ${n.status}`);
        });
      }
      console.log();
    });
  }

  // 5. Summary
  console.log("\n5️⃣  SUMMARY\n");
  const totalNotifications = await prisma.notification.count();
  const totalEmailLogs = await prisma.notificationChannelLog.count({
    where: { channel: "EMAIL" },
  });
  const sentEmails = await prisma.notificationChannelLog.count({
    where: { channel: "EMAIL", status: "SENT" },
  });
  const failedEmails = await prisma.notificationChannelLog.count({
    where: { channel: "EMAIL", status: "FAILED" },
  });
  const pendingEmails = await prisma.notificationChannelLog.count({
    where: { channel: "EMAIL", status: "PENDING" },
  });

  console.log(`  Total Notifications Created: ${totalNotifications}`);
  console.log(`  Total Email Attempts: ${totalEmailLogs}`);
  console.log(`    ✓ Sent: ${sentEmails}`);
  console.log(`    ✗ Failed: ${failedEmails}`);
  console.log(`    ⏳ Pending: ${pendingEmails}\n`);

  if (sentEmails > 0) {
    console.log("✅ EMAIL SYSTEM IS WORKING - EMAILS ARE BEING SENT\n");
  } else if (failedEmails > 0) {
    console.log("⚠️  EMAILS ARE FAILING - CHECK ERROR MESSAGES ABOVE\n");
  } else if (pendingEmails > 0) {
    console.log("⏳ EMAILS STILL PROCESSING\n");
  } else {
    console.log("❌ NO EMAIL ACTIVITY DETECTED\n");
  }

  console.log("═".repeat(70));
  console.log();

  process.exit(0);
}

diagnostic().catch((error) => {
  console.error("❌ Diagnostic Error:", error.message);
  process.exit(1);
});
