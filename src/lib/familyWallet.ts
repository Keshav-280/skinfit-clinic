import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  familyWalletMembers,
  familyWallets,
  familyWalletTransactions,
  users,
} from "@/src/db/schema";
import { ensureFamilyWalletSchema } from "@/src/lib/ensureFamilyWalletSchema";

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export type FamilyWalletMemberView = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  linkedAt: string;
};

export type FamilyWalletTransactionView = {
  id: string;
  type: "topup" | "deduction" | "refund";
  amountCredits: number;
  balanceAfter: number;
  patientName: string | null;
  note: string | null;
  createdAt: string;
};

export type FamilyWalletSnapshot = {
  walletId: string;
  displayName: string;
  balanceCredits: number;
  isOwner: boolean;
  ownerName: string;
  members: FamilyWalletMemberView[];
  recentTransactions: FamilyWalletTransactionView[];
};

async function loadMemberRows(walletId: string): Promise<FamilyWalletMemberView[]> {
  const rows = await db
    .select({
      userId: familyWalletMembers.userId,
      role: familyWalletMembers.role,
      linkedAt: familyWalletMembers.linkedAt,
      name: users.name,
      email: users.email,
    })
    .from(familyWalletMembers)
    .innerJoin(users, eq(users.id, familyWalletMembers.userId))
    .where(eq(familyWalletMembers.walletId, walletId))
    .orderBy(familyWalletMembers.linkedAt);

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    role: r.role,
    linkedAt: toIso(r.linkedAt),
  }));
}

async function loadRecentTransactions(
  walletId: string,
  limit = 8
): Promise<FamilyWalletTransactionView[]> {
  const rows = await db
    .select({
      id: familyWalletTransactions.id,
      type: familyWalletTransactions.type,
      amountCredits: familyWalletTransactions.amountCredits,
      balanceAfter: familyWalletTransactions.balanceAfter,
      note: familyWalletTransactions.note,
      createdAt: familyWalletTransactions.createdAt,
      patientName: users.name,
    })
    .from(familyWalletTransactions)
    .leftJoin(users, eq(users.id, familyWalletTransactions.patientUserId))
    .where(eq(familyWalletTransactions.walletId, walletId))
    .orderBy(desc(familyWalletTransactions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amountCredits: r.amountCredits,
    balanceAfter: r.balanceAfter,
    patientName: r.patientName,
    note: r.note,
    createdAt: toIso(r.createdAt),
  }));
}

export async function getWalletMembershipForUser(userId: string) {
  await ensureFamilyWalletSchema();
  const [row] = await db
    .select({
      walletId: familyWalletMembers.walletId,
      role: familyWalletMembers.role,
      ownerUserId: familyWallets.ownerUserId,
      displayName: familyWallets.displayName,
      balanceCredits: familyWallets.balanceCredits,
    })
    .from(familyWalletMembers)
    .innerJoin(familyWallets, eq(familyWallets.id, familyWalletMembers.walletId))
    .where(eq(familyWalletMembers.userId, userId))
    .limit(1);

  return row ?? null;
}

/** Ensures every patient has a wallet (solo owner with 0 credits if new). */
export async function getOrCreateWalletForUser(userId: string) {
  const existing = await getWalletMembershipForUser(userId);
  if (existing) return existing;

  const [wallet] = await db
    .insert(familyWallets)
    .values({ ownerUserId: userId })
    .returning({
      id: familyWallets.id,
      ownerUserId: familyWallets.ownerUserId,
      displayName: familyWallets.displayName,
      balanceCredits: familyWallets.balanceCredits,
    });

  await db.insert(familyWalletMembers).values({
    walletId: wallet.id,
    userId,
    role: "owner",
  });

  return {
    walletId: wallet.id,
    role: "owner" as const,
    ownerUserId: wallet.ownerUserId,
    displayName: wallet.displayName,
    balanceCredits: wallet.balanceCredits,
  };
}

export async function getFamilyWalletSnapshot(
  userId: string
): Promise<FamilyWalletSnapshot> {
  const membership = await getOrCreateWalletForUser(userId);

  const [owner] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, membership.ownerUserId))
    .limit(1);

  const [members, recentTransactions] = await Promise.all([
    loadMemberRows(membership.walletId),
    loadRecentTransactions(membership.walletId),
  ]);

  return {
    walletId: membership.walletId,
    displayName: membership.displayName,
    balanceCredits: membership.balanceCredits,
    isOwner: membership.role === "owner",
    ownerName: owner?.name ?? "Account holder",
    members,
    recentTransactions,
  };
}

export async function resolveWalletForPatient(patientId: string) {
  const membership = await getWalletMembershipForUser(patientId);
  if (!membership) {
    const created = await getOrCreateWalletForUser(patientId);
    return getFamilyWalletSnapshot(patientId);
  }
  return getFamilyWalletSnapshot(patientId);
}

export async function linkFamilyMember(args: {
  ownerUserId: string;
  inviteeUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (args.ownerUserId === args.inviteeUserId) {
    return { ok: false, error: "You cannot link your own email." };
  }

  const ownerMembership = await getOrCreateWalletForUser(args.ownerUserId);
  if (ownerMembership.role !== "owner") {
    return {
      ok: false,
      error: "Only the family card holder can link members.",
    };
  }

  const inviteeMembership = await getWalletMembershipForUser(args.inviteeUserId);
  if (inviteeMembership) {
    if (inviteeMembership.walletId === ownerMembership.walletId) {
      return { ok: false, error: "This person is already on your family card." };
    }
    return {
      ok: false,
      error: "This person is already linked to another family card.",
    };
  }

  const [inviteeOwnedWallet] = await db
    .select({ id: familyWallets.id, balanceCredits: familyWallets.balanceCredits })
    .from(familyWallets)
    .where(eq(familyWallets.ownerUserId, args.inviteeUserId))
    .limit(1);

  if (inviteeOwnedWallet) {
    const [otherMembers] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(familyWalletMembers)
      .where(
        and(
          eq(familyWalletMembers.walletId, inviteeOwnedWallet.id),
          ne(familyWalletMembers.userId, args.inviteeUserId)
        )
      );

    if (
      inviteeOwnedWallet.balanceCredits > 0 ||
      (otherMembers?.count ?? 0) > 0
    ) {
      return {
        ok: false,
        error:
          "This account has its own family card with balance or members. They must use that card or clear it first.",
      };
    }

    await db
      .delete(familyWallets)
      .where(eq(familyWallets.id, inviteeOwnedWallet.id));
  }

  await db.insert(familyWalletMembers).values({
    walletId: ownerMembership.walletId,
    userId: args.inviteeUserId,
    role: "member",
  });

  return { ok: true };
}

export async function removeFamilyMember(args: {
  ownerUserId: string;
  memberUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ownerMembership = await getWalletMembershipForUser(args.ownerUserId);
  if (!ownerMembership || ownerMembership.role !== "owner") {
    return { ok: false, error: "Only the card holder can remove members." };
  }
  if (args.memberUserId === args.ownerUserId) {
    return { ok: false, error: "You cannot remove yourself as the holder." };
  }

  const result = await db
    .delete(familyWalletMembers)
    .where(
      and(
        eq(familyWalletMembers.walletId, ownerMembership.walletId),
        eq(familyWalletMembers.userId, args.memberUserId),
        eq(familyWalletMembers.role, "member")
      )
    )
    .returning({ id: familyWalletMembers.id });

  if (result.length === 0) {
    return { ok: false, error: "Member not found on this card." };
  }

  await getOrCreateWalletForUser(args.memberUserId);
  return { ok: true };
}

export async function applyWalletTopUp(args: {
  patientUserId: string;
  amountCredits: number;
  performedByUserId: string;
  note?: string | null;
}): Promise<
  | { ok: true; balanceAfter: number }
  | { ok: false; error: string }
> {
  if (!Number.isInteger(args.amountCredits) || args.amountCredits <= 0) {
    return { ok: false, error: "Enter a positive whole-number amount." };
  }

  const snapshot = await resolveWalletForPatient(args.patientUserId);
  const newBalance = snapshot.balanceCredits + args.amountCredits;

  await db.transaction(async (tx) => {
    await tx
      .update(familyWallets)
      .set({ balanceCredits: newBalance, updatedAt: new Date() })
      .where(eq(familyWallets.id, snapshot.walletId));

    await tx.insert(familyWalletTransactions).values({
      walletId: snapshot.walletId,
      type: "topup",
      amountCredits: args.amountCredits,
      balanceAfter: newBalance,
      patientUserId: args.patientUserId,
      performedByUserId: args.performedByUserId,
      note: args.note?.trim() || null,
    });
  });

  return { ok: true, balanceAfter: newBalance };
}

export async function applyWalletDeduction(args: {
  patientUserId: string;
  amountCredits: number;
  performedByUserId: string;
  note?: string | null;
}): Promise<
  | { ok: true; balanceAfter: number }
  | { ok: false; error: string }
> {
  if (!Number.isInteger(args.amountCredits) || args.amountCredits <= 0) {
    return { ok: false, error: "Enter a positive whole-number amount." };
  }

  const snapshot = await resolveWalletForPatient(args.patientUserId);
  if (snapshot.balanceCredits < args.amountCredits) {
    return {
      ok: false,
      error: `Insufficient balance (${snapshot.balanceCredits} credits available).`,
    };
  }

  const newBalance = snapshot.balanceCredits - args.amountCredits;

  await db.transaction(async (tx) => {
    await tx
      .update(familyWallets)
      .set({ balanceCredits: newBalance, updatedAt: new Date() })
      .where(eq(familyWallets.id, snapshot.walletId));

    await tx.insert(familyWalletTransactions).values({
      walletId: snapshot.walletId,
      type: "deduction",
      amountCredits: -args.amountCredits,
      balanceAfter: newBalance,
      patientUserId: args.patientUserId,
      performedByUserId: args.performedByUserId,
      note: args.note?.trim() || null,
    });
  });

  return { ok: true, balanceAfter: newBalance };
}

export async function findPatientByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (!row || row.role !== "patient") return null;
  return row;
}
