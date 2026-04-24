import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const FREE_MATCH_LIMIT = 20;

// Auth guard (shared helper)
async function requireAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Niet ingelogd");
  return identity;
}

async function requireMember(ctx: any, teamId: any, requireAdmin = false) {
  const identity = await requireAuth(ctx);
  const member = await ctx.db
    .query("team_members")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", teamId).eq("userId", identity.subject)
    )
    .first();
  if (!member) throw new Error("Geen toegang tot dit team");
  if (requireAdmin && member.role !== "admin")
    throw new Error("Beheerder-rechten vereist");
  return { member, identity };
}

// ─── Internal helpers ────────────────────────────────────────

// Get or create subscription record for a team (defaults to free)
export async function getOrCreateSubscription(ctx: any, teamId: any) {
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_team_id", (q: any) => q.eq("teamId", teamId))
    .first();
  if (existing) return existing;

  // New team → create free subscription record
  const id = await ctx.db.insert("subscriptions", {
    teamId,
    stripeCustomerId: "",
    status: "free",
  });
  return await ctx.db.get(id);
}

// ─── Queries ─────────────────────────────────────────────────

export const getSubscription = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.teamId);
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_team_id", (q: any) => q.eq("teamId", args.teamId))
      .first();
    // Return free defaults if no record yet
    return sub ?? { status: "free", teamId: args.teamId, stripeCustomerId: "" };
  },
});

export const getMatchCount = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.teamId);
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q: any) => q.eq("team_id", args.teamId))
      .collect();
    return { count: matches.length, limit: FREE_MATCH_LIMIT };
  },
});

// ─── Mutations (internal) ────────────────────────────────────

export const upsertSubscription = mutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.union(v.literal("free"), v.literal("starter"), v.literal("club")),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q: any) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeSubscriptionId: args.stripeSubscriptionId,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      });
    }
  },
});

// ─── Actions (Stripe API calls) ──────────────────────────────

export const createCheckoutSession = action({
  args: {
    teamId: v.id("teams"),
    priceId: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niet ingelogd");

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new Error("Stripe niet geconfigureerd");

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    // Get or create subscription record (to attach stripeCustomerId)
    const sub: any = await ctx.runQuery(api.subscriptions.getSubscription, {
      teamId: args.teamId,
    });

    let customerId = sub?.stripeCustomerId || undefined;

    // Create new Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: identity.email ?? undefined,
        name: identity.name ?? undefined,
        metadata: { teamId: args.teamId, userId: identity.subject },
      });
      customerId = customer.id;

      // Save customerId to DB
      await ctx.runMutation(api.subscriptions._saveCustomerId, {
        teamId: args.teamId,
        stripeCustomerId: customerId,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card", "ideal"],
      line_items: [{ price: args.priceId, quantity: 1 }],
      mode: "subscription",
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: { teamId: args.teamId },
    });

    return session.url!;
  },
});

export const createPortalSession = action({
  args: {
    teamId: v.id("teams"),
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niet ingelogd");

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new Error("Stripe niet geconfigureerd");

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const sub: any = await ctx.runQuery(api.subscriptions.getSubscription, {
      teamId: args.teamId,
    });

    if (!sub?.stripeCustomerId)
      throw new Error("Geen actief abonnement gevonden");

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: args.returnUrl,
    });

    return session.url;
  },
});

// Internal: save customerId after creation
export const _saveCustomerId = mutation({
  args: {
    teamId: v.id("teams"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_team_id", (q: any) => q.eq("teamId", args.teamId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        teamId: args.teamId,
        stripeCustomerId: args.stripeCustomerId,
        status: "free",
      });
    }
  },
});
