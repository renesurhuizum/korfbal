import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Missing VITE_CONVEX_URL environment variable. " +
    "Please add it to your .env file or Vercel environment variables."
  );
}

export const convex = new ConvexReactClient(convexUrl);
