import { ShoppingBag, Sparkles, Star } from "lucide-react";

import type { RegisterForm } from "../page";

export const INITIAL_FORM: RegisterForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  city: "",
  agreeToTerms: false,
};

export const REGISTER_STEPS = [
  { label: "Account", hint: "Who are you" },
  { label: "Security", hint: "Lock it down" },
  { label: "Profile", hint: "Almost there" },
] as const;

export const BRAND_PERKS = [
  {
    icon: ShoppingBag,
    title: "Hyper-local catalog",
    body: "Discover 10,000+ products from verified stores within 50km of you.",
  },
  {
    icon: Sparkles,
    title: "Member-only deals",
    body: "Unlock weekly drops, flash prices, and early access to new arrivals.",
  },
  {
    icon: Star,
    title: "Trusted by 50K+",
    body: "Rated 4.8★ by shoppers who keep coming back for the convenience.",
  },
] as const;

export const BRAND_STATS = [
  { value: "50K+", label: "Members" },
  { value: "500+", label: "Stores" },
  { value: "4.8★", label: "Rating" },
] as const;

export const PASSWORD_LABELS = [
  "Too weak",
  "Weak",
  "Okay",
  "Strong",
  "Excellent",
] as const;

export const PASSWORD_COLOR_CLASSES = [
  "bg-red-400",
  "bg-amber-400",
  "bg-yellow-400",
  "bg-emerald-400",
  "bg-emerald-500",
] as const;
