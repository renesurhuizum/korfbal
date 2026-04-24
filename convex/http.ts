import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Stripe webhook handler
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      return new Response("Stripe niet geconfigureerd", { status: 500 });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const body = await request.text();
    const sig = request.headers.get("stripe-signature");
    if (!sig) return new Response("Geen signature", { status: 400 });

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch {
      return new Response("Webhook verificatie mislukt", { status: 400 });
    }

    const statusMap: Record<string, "free" | "starter" | "club"> = {
      // Map Stripe price IDs to plan names via metadata or price lookup
      // For now map subscription statuses to plan tiers
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;

        // Determine plan from metadata or line items
        const priceId = session.line_items?.data?.[0]?.price?.id;
        const plan = getPlanFromPriceId(priceId) ?? "starter";

        await ctx.runMutation(api.subscriptions.upsertSubscription, {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          status: plan,
          currentPeriodEnd: undefined,
          cancelAtPeriodEnd: false,
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const plan = getPlanFromPriceId(sub.items?.data?.[0]?.price?.id) ?? "starter";
        const isActive = sub.status === "active" || sub.status === "trialing";

        await ctx.runMutation(api.subscriptions.upsertSubscription, {
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          status: isActive ? plan : "free",
          currentPeriodEnd: sub.current_period_end
            ? sub.current_period_end * 1000
            : undefined,
          cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await ctx.runMutation(api.subscriptions.upsertSubscription, {
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          status: "free",
          currentPeriodEnd: undefined,
          cancelAtPeriodEnd: false,
        });
        break;
      }
    }

    return new Response(null, { status: 200 });
  }),
});

// Map Stripe price IDs to plan names.
// Set STRIPE_PRICE_STARTER and STRIPE_PRICE_CLUB env vars in Convex dashboard.
function getPlanFromPriceId(priceId?: string): "starter" | "club" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_CLUB) return "club";
  return null;
}

export default http;
