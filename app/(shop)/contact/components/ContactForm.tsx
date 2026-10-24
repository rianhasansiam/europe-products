"use client";
import { useLocaleDraft, useLocaleSwitchGuard } from "@/components/i18n/useLocaleDraft";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useId, useState, type Dispatch, type SetStateAction } from "react";
import Link from "@/lib/i18n/navigation";
import emailjs from "@emailjs/browser";
import {
  Send,
  User,
  Mail,
  Phone,
  MessageSquare,
  Tag,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "@/lib/feedback";
import { siteConfig } from "@/lib/seo/site";
import { ButtonLoader } from "@/components/ui/loading";

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? "";
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? "";

const subjects = [
  "General Inquiry",
  "Order Support",
  "Returns & Refunds",
  `Partnership / Sell on ${siteConfig.name}`,
  "Bug Report",
  "Other",
];

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const i18n = useInterfaceTranslations("InterfaceContactComponentsContactForm");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState(subjects[0]);
  const [message, setMessage] = useState("");
  const contactDraft = { name, email, phone, subject, message };
  const restoreContactDraft: Dispatch<SetStateAction<typeof contactDraft>> = (update) => {
    const next = typeof update === "function" ? update(contactDraft) : update;
    setName(next.name); setEmail(next.email); setPhone(next.phone);
    setSubject(next.subject); setMessage(next.message);
  };
  useLocaleDraft("contact-message", contactDraft, restoreContactDraft, ["name", "email", "phone", "subject", "message"]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const isSending = status === "sending";
  useLocaleSwitchGuard(isSending);
  const fieldsDisabled = status === "sending" || status === "sent";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const emailJsConfigured = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

    const visitTime = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const templateParams = {
      from_name: name,
      user_email: email,
      subject,
      phone: phone || "Not provided",
      message,
      visit_time: visitTime,
    };

    try {
      // 1) Persist to our own DB first so we never lose a message even
      //    if EmailJS hiccups. The API responds 201 on success and
      //    revalidates the admin "Messages" cache for us.
      const dbResponse = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          subject,
          message,
        }),
      });

      if (!dbResponse.ok) {
        let payload: unknown = null;
        try {
          payload = (await dbResponse.json()) as unknown;
        } catch {
          // ignore
        }
        const fallback = "We couldn't save your message. Please try again.";
        const apiError =
          payload && typeof payload === "object"
            ? ((payload as { error?: string }).error ?? fallback)
            : fallback;
        throw new Error(apiError);
      }

      // 2) Best-effort email notification. A failure here doesn't roll
      //    back the saved message — admin still sees it in the panel.
      if (emailJsConfigured) {
        try {
          await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, {
            publicKey: PUBLIC_KEY,
          });
        } catch (emailErr) {
          console.warn("[contact] EmailJS notification failed", emailErr);
        }
      } else {
        console.warn(
          "[contact] EmailJS not configured — message saved to DB only.",
        );
      }

      setStatus("sent");
      setName("");
      setEmail("");
      setPhone("");
      setSubject(subjects[0]);
      setMessage("");
      toast.success(i18n("Message sent! We'll get back to you shortly."));
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error
        ? err.message
        : "Something went wrong. Please try again.";
      setErrorMsg(msg);
      toast.error(i18n(msg));
    }
  };

  return (
    <section
      id="contact-form"
      className="grid gap-6 lg:grid-cols-5 lg:gap-8"
    >
      {/* Left: Contextual panel */}
      <div className="lg:col-span-2">
        <div className="relative h-full overflow-hidden rounded-3xl bg-brand-black p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute top-0 end-0 h-32 w-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 start-0 h-40 w-40 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/3" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm ring-1 ring-white/20">
              <MessageSquare className="h-3.5 w-3.5 text-brand-gold" />
              <span className="text-[11px] font-bold uppercase tracking-wide">
                {i18n("Drop a line")}</span>
            </div>

            <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
              {i18n("Let's start a conversation")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              {i18n("Tell us about your question, idea, or feedback. The more context, the better we can help.")}</p>

            <ul className="mt-6 space-y-3">
              {[
                i18n("Quick replies, usually within 2 hours"),
                i18n("Real humans, no bots or canned answers"),
                i18n("Available 7 days a week, 9am to 9pm"),
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                  <span className="text-white/90">{tip}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-white/70">
                {i18n("Prefer email?")}</p>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="mt-1 block text-base font-black text-brand-gold hover:underline"
              >
                {siteConfig.contact.email}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="lg:col-span-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-brand-border sm:p-8">
          <h3 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
            {i18n("Send us a message")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {i18n("Fill in the details below and we'll get back to you shortly.")}</p>

          <div className="my-5 h-0.5 w-full bg-brand-border rounded-full" />

          <form data-locale-recoverable onSubmit={handleSubmit} className="space-y-4" aria-busy={isSending}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={i18n("Full Name")}
                icon={<User className="h-4 w-4" />}
                value={name}
                onChange={setName}
                placeholder={i18n("Your name")}
                disabled={fieldsDisabled}
                required
              />
              <Field
                label={i18n("Email")}
                icon={<Mail className="h-4 w-4" />}
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                type="email"
                disabled={fieldsDisabled}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={i18n("Phone (optional)")}
                icon={<Phone className="h-4 w-4" />}
                value={phone}
                onChange={setPhone}
                placeholder="+91 ..."
                type="tel"
                disabled={fieldsDisabled}
              />

              <div>
                <label htmlFor="contact-subject" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-foreground">
                  {i18n("Subject")}</label>
                <div className="relative">
                  <Tag className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    id="contact-subject"
                    aria-label={i18n("Subject")}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={fieldsDisabled}
                    className="h-11 w-full appearance-none rounded-xl border border-brand-border bg-white ps-9 pe-9 text-sm text-foreground shadow-sm transition-colors focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                  >
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s === subjects[3] ? i18n("Partnership / Sell on {brand}", { brand: siteConfig.name }) : i18n(s)}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ▾
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-foreground">
                {i18n("Message")}</label>
              <textarea
                id="contact-message"
                aria-label={i18n("Message")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={i18n("Tell us how we can help...")}
                rows={5}
                required
                disabled={fieldsDisabled}
                className="w-full resize-none rounded-xl border border-brand-border bg-white p-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                {i18n.rich("By sending, you agree to our <policy>Privacy Policy</policy>.", {
                  policy: (chunks) => <Link href="/privacy-policy" className="font-semibold text-brand-red hover:underline">{chunks}</Link>,
                })}
              </p>

              <button
                type="submit"
                disabled={fieldsDisabled}
                aria-busy={isSending}
                className="group inline-flex items-center gap-2 rounded-full bg-brand-red px-6 py-2.5 text-sm font-bold text-brand-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-80"
              >
                {status === "sending" && (
                  <ButtonLoader label={i18n("Sending...")} />
                )}
                {status === "sent" && (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {i18n("Message Sent")}</>
                )}
                {(status === "idle" || status === "error") && (
                  <>
                    <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    {i18n("Send Message")}</>
                )}
              </button>
            </div>

            {status === "error" && errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{i18n(errorMsg)}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
};

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  disabled,
}: FieldProps) {
  const inputId = useId();
  const i18n = useInterfaceTranslations("InterfaceContactComponentsContactForm");
  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-foreground">
        {i18n(label)}
      </label>
      <div className="relative" dir={type === "email" || type === "tel" ? "ltr" : undefined}>
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        <input
          id={inputId}
          type={type}
          aria-label={label}
          value={value}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={i18n(placeholder)}
          className="h-11 w-full rounded-xl border border-brand-border bg-white ps-9 pe-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/30"
        />
      </div>
    </div>
  );
}
