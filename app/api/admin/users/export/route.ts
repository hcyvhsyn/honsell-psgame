import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "";
  const role = url.searchParams.get("role") ?? "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { referralCode: { contains: q.toUpperCase() } },
    ];
  }
  if (status === "verified") where.emailVerified = true;
  else if (status === "pending") where.emailVerified = false;
  else if (status === "disabled") where.disabled = true;
  if (role === "admin") where.role = "ADMIN";
  else if (role === "user") where.role = "USER";
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.createdAt = range;
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      emailVerified: true,
      disabled: true,
      walletBalance: true,
      cashbackBalanceCents: true,
      referralBalanceCents: true,
      referralCode: true,
      referredById: true,
      createdAt: true,
    },
  });

  const userIds = users.map((u) => u.id);
  const spent = userIds.length
    ? await prisma.transaction.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          status: "SUCCESS",
          type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        },
        _sum: { amountAznCents: true },
        _count: { _all: true },
      })
    : [];
  const spentMap = new Map<string, { spent: number; orders: number }>();
  for (const r of spent) {
    spentMap.set(r.userId, {
      spent: Math.abs(r._sum.amountAznCents ?? 0),
      orders: r._count._all,
    });
  }

  const header = [
    "id",
    "email",
    "name",
    "phone",
    "role",
    "emailVerified",
    "disabled",
    "walletAzn",
    "cashbackAzn",
    "referralAzn",
    "referralCode",
    "spentAzn",
    "orderCount",
    "createdAt",
  ];

  const lines = [header.join(",")];
  for (const u of users) {
    const agg = spentMap.get(u.id);
    lines.push(
      [
        u.id,
        u.email,
        u.name ?? "",
        u.phone ?? "",
        u.role,
        u.emailVerified ? "yes" : "no",
        u.disabled ? "yes" : "no",
        (u.walletBalance / 100).toFixed(2),
        (u.cashbackBalanceCents / 100).toFixed(2),
        (u.referralBalanceCents / 100).toFixed(2),
        u.referralCode,
        ((agg?.spent ?? 0) / 100).toFixed(2),
        agg?.orders ?? 0,
        u.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="users-${stamp}.csv"`,
    },
  });
}
