import { Clock, ShoppingBag, Tag } from "lucide-react";

import type { LoginForm } from "../page";

export const INITIAL_FORM: LoginForm = {
  email: "",
  password: "",
};

export const BRAND_PERKS = [
  {
    icon: ShoppingBag,
    title: "Pick up where you left off",
    body: "Your saved cart, wishlist, and addresses are right where you left them.",
  },
  {
    icon: Tag,
    title: "Member-only deals",
    body: "Sign in to unlock weekly drops and personalized offers from local stores.",
  },
  {
    icon: Clock,
    title: "Faster checkout",
    body: "Saved details mean one-tap orders the moment a deal goes live.",
  },
] as const;

export const BRAND_STATS = [
  { value: "50K+", label: "Members" },
  { value: "500+", label: "Stores" },
  { value: "4.8★", label: "Rating" },
] as const;
