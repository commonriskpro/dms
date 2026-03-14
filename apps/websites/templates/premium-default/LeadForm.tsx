"use client";

import * as React from "react";
import type { WebsiteLeadFormType } from "@dms/contracts";

type Props = {
  formType: WebsiteLeadFormType;
  vehicleSlug?: string;
  vehicleTitle?: string;
  primaryColor?: string;
  onSuccess?: () => void;
};

const FORM_TITLES: Record<WebsiteLeadFormType, string> = {
  CONTACT: "Contact Us",
  CHECK_AVAILABILITY: "Check Availability",
  TEST_DRIVE: "Schedule a Test Drive",
  GET_EPRICE: "Get e-Price",
  FINANCING: "Get Pre-Qualified",
  TRADE_VALUE: "Get Trade-In Value",
};

export function LeadForm({
  formType,
  vehicleSlug,
  vehicleTitle,
  primaryColor = "#1a56db",
  onSuccess,
}: Props) {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [hp, setHp] = React.useState(""); // honeypot
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      // dealershipId is NOT sent from the browser — the proxy resolves tenant from hostname
      const body: Record<string, unknown> = {
        formType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
        _hp: hp,
      };

      if (vehicleSlug) {
        body.vehicleSlug = vehicleSlug;
      }

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "Something went wrong. Please try again.");
      }

      setStatus("success");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-semibold text-green-800">Thank you!</h3>
        <p className="mt-1 text-sm text-green-700">We received your message and will be in touch shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{FORM_TITLES[formType]}</h3>
      {vehicleTitle && (
        <p className="text-sm text-gray-500">Regarding: <strong className="text-gray-700">{vehicleTitle}</strong></p>
      )}

      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="_hp"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute -left-full opacity-0 pointer-events-none"
        autoComplete="off"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
            style={{ focusRingColor: primaryColor } as React.CSSProperties}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
          <input
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
        />
      </div>

      {(formType === "CONTACT" || formType === "CHECK_AVAILABILITY" || formType === "TEST_DRIVE") && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
          />
        </div>
      )}

      {status === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
        style={{ backgroundColor: primaryColor }}
      >
        {status === "submitting" ? "Sending…" : "Send Message"}
      </button>

      <p className="text-center text-xs text-gray-400">
        By submitting, you agree to be contacted by our team.
      </p>
    </form>
  );
}
