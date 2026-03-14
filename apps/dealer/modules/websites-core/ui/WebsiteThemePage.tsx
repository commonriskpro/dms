"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { WriteGuard } from "@/components/write-guard";
import type { WebsiteSiteDto, WebsiteThemeConfig, WebsiteContactConfig, WebsiteSocialConfig, UpdateWebsiteSiteBody } from "@dms/contracts";
import { websiteThemeConfigSchema, websiteContactConfigSchema, websiteSocialConfigSchema } from "@dms/contracts";
import { z } from "zod";

type SiteResponse = { data: WebsiteSiteDto | null };

// ─── Theme Form ────────────────────────────────────────────────────────────────

function ThemeForm({ site, onSaved }: { site: WebsiteSiteDto; onSaved: (updated: WebsiteSiteDto) => void }) {
  const { addToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<WebsiteThemeConfig>({
    resolver: zodResolver(websiteThemeConfigSchema),
    defaultValues: {
      logoUrl: site.themeConfig?.logoUrl ?? "",
      primaryColor: site.themeConfig?.primaryColor ?? "#1a56db",
      accentColor: site.themeConfig?.accentColor ?? "#0ea5e9",
      headerBgColor: site.themeConfig?.headerBgColor ?? "#ffffff",
      fontFamily: site.themeConfig?.fontFamily ?? "Inter",
    },
  });

  async function onSubmit(themeConfig: WebsiteThemeConfig) {
    try {
      const r = await apiFetch<SiteResponse>("/api/websites/site", {
        method: "PATCH",
        body: JSON.stringify({ themeConfig } satisfies UpdateWebsiteSiteBody),
      });
      if (r.data) onSaved(r.data);
      addToast("success", "Theme settings saved.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="th-logo">Logo URL</Label>
          <Input id="th-logo" type="url" placeholder="https://example.com/logo.png" {...register("logoUrl")} />
          {errors.logoUrl && <p className="text-xs text-[var(--danger)]">{errors.logoUrl.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="th-font">Font Family</Label>
          <Input id="th-font" placeholder="Inter" {...register("fontFamily")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="th-primary">Primary Color</Label>
          <div className="flex items-center gap-2">
            <input type="color" id="th-primary-picker" {...register("primaryColor")} className="h-9 w-10 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5" />
            <Input id="th-primary" placeholder="#1a56db" {...register("primaryColor")} className="flex-1 font-mono" />
          </div>
          {errors.primaryColor && <p className="text-xs text-[var(--danger)]">{errors.primaryColor.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="th-accent">Accent Color</Label>
          <div className="flex items-center gap-2">
            <input type="color" id="th-accent-picker" {...register("accentColor")} className="h-9 w-10 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5" />
            <Input id="th-accent" placeholder="#0ea5e9" {...register("accentColor")} className="flex-1 font-mono" />
          </div>
          {errors.accentColor && <p className="text-xs text-[var(--danger)]">{errors.accentColor.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="th-header-bg">Header Background</Label>
          <div className="flex items-center gap-2">
            <input type="color" id="th-header-bg-picker" {...register("headerBgColor")} className="h-9 w-10 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5" />
            <Input id="th-header-bg" placeholder="#ffffff" {...register("headerBgColor")} className="flex-1 font-mono" />
          </div>
          {errors.headerBgColor && <p className="text-xs text-[var(--danger)]">{errors.headerBgColor.message}</p>}
        </div>
      </div>
      <WriteGuard>
        <Button type="submit" variant="primary" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save Theme"}
        </Button>
      </WriteGuard>
    </form>
  );
}

// ─── Contact Form ──────────────────────────────────────────────────────────────

function ContactForm({ site, onSaved }: { site: WebsiteSiteDto; onSaved: (updated: WebsiteSiteDto) => void }) {
  const { addToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<WebsiteContactConfig>({
    resolver: zodResolver(websiteContactConfigSchema),
    defaultValues: {
      phone: site.contactConfig?.phone ?? "",
      email: site.contactConfig?.email ?? "",
      addressLine1: site.contactConfig?.addressLine1 ?? "",
      city: site.contactConfig?.city ?? "",
      state: site.contactConfig?.state ?? "",
      zip: site.contactConfig?.zip ?? "",
    },
  });

  async function onSubmit(contactConfig: WebsiteContactConfig) {
    try {
      const r = await apiFetch<SiteResponse>("/api/websites/site", {
        method: "PATCH",
        body: JSON.stringify({ contactConfig } satisfies UpdateWebsiteSiteBody),
      });
      if (r.data) onSaved(r.data);
      addToast("success", "Contact info saved.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ct-phone">Phone</Label>
          <Input id="ct-phone" type="tel" placeholder="+1 (555) 000-0000" {...register("phone")} />
          {errors.phone && <p className="text-xs text-[var(--danger)]">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-email">Email</Label>
          <Input id="ct-email" type="email" placeholder="info@dealership.com" {...register("email")} />
          {errors.email && <p className="text-xs text-[var(--danger)]">{errors.email.message}</p>}
        </div>
        <div className="col-span-full space-y-1.5">
          <Label htmlFor="ct-address">Address</Label>
          <Input id="ct-address" placeholder="123 Main St" {...register("addressLine1")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-city">City</Label>
          <Input id="ct-city" {...register("city")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ct-state">State</Label>
            <Input id="ct-state" maxLength={2} placeholder="CA" {...register("state")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-zip">ZIP</Label>
            <Input id="ct-zip" placeholder="90210" {...register("zip")} />
          </div>
        </div>
      </div>
      <WriteGuard>
        <Button type="submit" variant="primary" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save Contact Info"}
        </Button>
      </WriteGuard>
    </form>
  );
}

// ─── Social Form ──────────────────────────────────────────────────────────────

function SocialForm({ site, onSaved }: { site: WebsiteSiteDto; onSaved: (updated: WebsiteSiteDto) => void }) {
  const { addToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<WebsiteSocialConfig>({
    resolver: zodResolver(websiteSocialConfigSchema),
    defaultValues: {
      facebook: site.socialConfig?.facebook ?? "",
      instagram: site.socialConfig?.instagram ?? "",
      twitter: site.socialConfig?.twitter ?? "",
      youtube: site.socialConfig?.youtube ?? "",
      tiktok: site.socialConfig?.tiktok ?? "",
    },
  });

  async function onSubmit(socialConfig: WebsiteSocialConfig) {
    try {
      const r = await apiFetch<SiteResponse>("/api/websites/site", {
        method: "PATCH",
        body: JSON.stringify({ socialConfig } satisfies UpdateWebsiteSiteBody),
      });
      if (r.data) onSaved(r.data);
      addToast("success", "Social links saved.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {(["facebook", "instagram", "twitter", "youtube", "tiktok"] as const).map((platform) => (
          <div key={platform} className="space-y-1.5">
            <Label htmlFor={`soc-${platform}`} className="capitalize">{platform}</Label>
            <Input id={`soc-${platform}`} type="url" placeholder={`https://${platform}.com/…`} {...register(platform)} />
            {errors[platform] && <p className="text-xs text-[var(--danger)]">{errors[platform]?.message}</p>}
          </div>
        ))}
      </div>
      <WriteGuard>
        <Button type="submit" variant="primary" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save Social Links"}
        </Button>
      </WriteGuard>
    </form>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function WebsiteThemePage() {
  const [site, setSite] = React.useState<WebsiteSiteDto | null | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<SiteResponse>("/api/websites/site")
      .then((r) => setSite(r.data))
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-96 rounded-[var(--radius-card)]" />;
  if (error) return <ErrorState message={error} />;
  if (!site) {
    return (
      <div className="py-16 text-center text-sm text-[var(--text-soft)]">
        No website found. Please initialize your website first.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Theme & Branding</h1>
        <p className="text-sm text-[var(--text-soft)]">
          Configure logo, colors, contact info, and social links. Layout and template code are managed by the platform.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Visual Theme</CardTitle></CardHeader>
        <CardContent><ThemeForm site={site} onSaved={setSite} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
        <CardContent><ContactForm site={site} onSaved={setSite} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Social Links</CardTitle></CardHeader>
        <CardContent><SocialForm site={site} onSaved={setSite} /></CardContent>
      </Card>
    </div>
  );
}
