import { createHmac, timingSafeEqual } from 'crypto';
import { envValue } from './paths';
import type {
  BillingCycle,
  BillingPlanId,
  BillingSettings,
  BillingVariantConfig,
  BillingWebhookEvent,
} from './types';

export interface BillingCheckoutRequest {
  planId: BillingPlanId;
  cycle?: BillingCycle;
  seats?: number;
  email?: string;
  name?: string;
  source?: string;
}

export interface BillingCheckoutResponse {
  checkoutUrl: string;
  planId: BillingPlanId;
  cycle: BillingCycle;
  provider: 'lemonsqueezy';
  ready: boolean;
  issues: string[];
  storeSlug?: string;
  variantId?: string;
  contactSalesUrl?: string;
}

export interface BillingConfigView extends BillingSettings {
  ready: boolean;
  issues: string[];
  checkoutTargets: Record<Exclude<BillingPlanId, 'free'>, Record<BillingCycle, string | undefined>>;
}

const emptyVariant: BillingVariantConfig = {};

export function defaultBillingSettings(): BillingSettings {
  return {
    provider: 'lemonsqueezy',
    enabled: false,
    storeSlug: undefined,
    variants: {
      pro: { ...emptyVariant },
      team: { ...emptyVariant },
      enterprise: { ...emptyVariant },
    },
    contactSalesUrl: undefined,
    successUrl: undefined,
    webhookSecret: undefined,
    lastCheckoutAt: undefined,
    lastCheckoutCycle: undefined,
    lastCheckoutPlanId: undefined,
    lastWebhookEvent: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function resolveBillingSettings(settings?: Partial<BillingSettings>): BillingSettings {
  const defaults = defaultBillingSettings();
  const envStore = normalizeStoreSlug(envValue('LEMONSQUEEZY_STORE'));
  const envContactSalesUrl = envValue('LEMONSQUEEZY_CONTACT_SALES_URL');
  const envSuccessUrl = envValue('LEMONSQUEEZY_SUCCESS_URL');
  const envWebhookSecret = envValue('LEMONSQUEEZY_WEBHOOK_SECRET');
  const envVariants = {
    pro: {
      monthly: envValue('LEMONSQUEEZY_PRO_MONTHLY_VARIANT'),
      annual: envValue('LEMONSQUEEZY_PRO_ANNUAL_VARIANT'),
    },
    team: {
      monthly: envValue('LEMONSQUEEZY_TEAM_MONTHLY_VARIANT'),
      annual: envValue('LEMONSQUEEZY_TEAM_ANNUAL_VARIANT'),
    },
    enterprise: {
      monthly: envValue('LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT'),
      annual: envValue('LEMONSQUEEZY_ENTERPRISE_ANNUAL_VARIANT'),
    },
  };
  const localVariants = settings?.variants || defaults.variants;
  const merged: BillingSettings = {
    ...defaults,
    ...(settings || {}),
    storeSlug: normalizeStoreSlug(settings?.storeSlug) || envStore,
    contactSalesUrl: trim(settings?.contactSalesUrl) || envContactSalesUrl || defaults.contactSalesUrl,
    successUrl: trim(settings?.successUrl) || envSuccessUrl || defaults.successUrl,
    webhookSecret: trim(settings?.webhookSecret) || envWebhookSecret || defaults.webhookSecret,
    variants: {
      pro: mergeVariant(settings?.variants?.pro, envVariants.pro),
      team: mergeVariant(settings?.variants?.team, envVariants.team),
      enterprise: mergeVariant(settings?.variants?.enterprise, envVariants.enterprise),
    },
    enabled: Boolean(settings?.enabled || envStore || hasAnyVariant({ variants: localVariants }, envVariants)),
    updatedAt: settings?.updatedAt || defaults.updatedAt,
  };
  return merged;
}

export function billingIssues(settings?: Partial<BillingSettings>): string[] {
  const merged = resolveBillingSettings(settings);
  const issues: string[] = [];
  if (!merged.storeSlug) issues.push('Set a Lemon Squeezy store slug.');
  if (!merged.variants.pro.monthly && !merged.variants.pro.annual) issues.push('Add at least one variant id for Pro.');
  if (!merged.variants.team.monthly && !merged.variants.team.annual) issues.push('Add at least one variant id for Team.');
  if (!merged.contactSalesUrl) issues.push('Set a contact sales URL for Enterprise.');
  return issues;
}

export function buildBillingConfigView(settings?: Partial<BillingSettings>): BillingConfigView {
  const resolved = resolveBillingSettings(settings);
  return {
    ...resolved,
    ready: billingIssues(settings).length === 0,
    issues: billingIssues(settings),
    checkoutTargets: {
      pro: {
        monthly: checkoutVariantId(resolved, 'pro', 'monthly'),
        annual: checkoutVariantId(resolved, 'pro', 'annual'),
      },
      team: {
        monthly: checkoutVariantId(resolved, 'team', 'monthly'),
        annual: checkoutVariantId(resolved, 'team', 'annual'),
      },
      enterprise: {
        monthly: checkoutVariantId(resolved, 'enterprise', 'monthly'),
        annual: checkoutVariantId(resolved, 'enterprise', 'annual'),
      },
    },
  };
}

export function buildCheckoutUrl(settings: Partial<BillingSettings>, request: BillingCheckoutRequest): BillingCheckoutResponse {
  const resolved = resolveBillingSettings(settings);
  const planId = request.planId;
  const cycle = request.cycle || 'monthly';
  if (planId === 'free') {
    throw new Error('The free plan does not use Lemon Squeezy checkout.');
  }
  if (planId === 'enterprise' && resolved.contactSalesUrl) {
    return {
      checkoutUrl: buildUrl(resolved.contactSalesUrl, buildCustomParams(request)),
      planId,
      cycle,
      provider: 'lemonsqueezy',
      ready: billingIssues(settings).length === 0,
      issues: billingIssues(settings),
      storeSlug: resolved.storeSlug,
      contactSalesUrl: resolved.contactSalesUrl,
    };
  }

  const variantId = checkoutVariantId(resolved, planId, cycle);
  if (!resolved.storeSlug) throw new Error('Lemon Squeezy store slug is not configured.');
  if (!variantId) throw new Error(`Missing Lemon Squeezy ${planId} ${cycle} variant id.`);

  const checkoutUrl = buildUrl(`https://${resolved.storeSlug}.lemonsqueezy.com/checkout/buy/${variantId}`, buildCustomParams(request));
  return {
    checkoutUrl,
    planId,
    cycle,
    provider: 'lemonsqueezy',
    ready: billingIssues(settings).length === 0,
    issues: billingIssues(settings),
    storeSlug: resolved.storeSlug,
    variantId,
    contactSalesUrl: resolved.contactSalesUrl,
  };
}

export function verifyBillingWebhook(rawBody: string, signature: string | undefined, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(signature.trim());
  return expectedBytes.length === signatureBytes.length && timingSafeEqual(expectedBytes, signatureBytes);
}

export function parseBillingWebhookEvent(rawBody: string, signatureVerified: boolean): BillingWebhookEvent {
  const payload = safeJsonParse(rawBody);
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const meta = body.meta && typeof body.meta === 'object' ? body.meta as Record<string, unknown> : {};
  return {
    receivedAt: new Date().toISOString(),
    eventName: typeof meta.event_name === 'string' ? meta.event_name : undefined,
    signatureVerified,
    payload,
  };
}

function buildCustomParams(request: BillingCheckoutRequest): URLSearchParams {
  const params = new URLSearchParams();
  params.set('checkout[custom][source]', request.source || 'talocode');
  params.set('checkout[custom][plan]', request.planId);
  params.set('checkout[custom][cycle]', request.cycle || 'monthly');
  if (typeof request.seats === 'number' && Number.isFinite(request.seats)) {
    params.set('checkout[custom][seats]', String(Math.max(1, Math.floor(request.seats))));
  }
  if (request.email?.trim()) params.set('checkout[email]', request.email.trim());
  if (request.name?.trim()) params.set('checkout[name]', request.name.trim());
  return params;
}

function buildUrl(baseUrl: string, params: URLSearchParams): string {
  const url = new URL(baseUrl);
  for (const [key, value] of params.entries()) url.searchParams.set(key, value);
  return url.toString();
}

function checkoutVariantId(settings: BillingSettings, planId: Exclude<BillingPlanId, 'free'>, cycle: BillingCycle): string | undefined {
  return settings.variants[planId]?.[cycle] || settings.variants[planId]?.monthly || settings.variants[planId]?.annual;
}

function mergeVariant(local?: BillingVariantConfig, env?: BillingVariantConfig): BillingVariantConfig {
  return {
    monthly: trim(local?.monthly) || trim(env?.monthly),
    annual: trim(local?.annual) || trim(env?.annual),
  };
}

function normalizeStoreSlug(input?: string): string | undefined {
  const value = trim(input);
  if (!value) return undefined;
  return value
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '')
    .replace(/\.lemonsqueezy\.com.*$/i, '');
}

function trim(input?: string): string | undefined {
  const value = input?.trim();
  return value ? value : undefined;
}

function hasAnyVariant(settings: Pick<BillingSettings, 'variants'>, envVariants: Record<Exclude<BillingPlanId, 'free'>, BillingVariantConfig>): boolean {
  const values = [
    settings.variants.pro?.monthly,
    settings.variants.pro?.annual,
    settings.variants.team?.monthly,
    settings.variants.team?.annual,
    envVariants.pro?.monthly,
    envVariants.pro?.annual,
    envVariants.team?.monthly,
    envVariants.team?.annual,
  ];
  return values.some((value) => Boolean(trim(value)));
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
