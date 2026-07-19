import { createHmac, timingSafeEqual } from "crypto";

export type StripeBillingPlan = "growth" | "scale";

interface StripePlanConfig {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

const STRIPE_API_URL = "https://api.stripe.com/v1";

export class StripeConfigError extends Error {
  constructor(message = "Stripe ainda nao esta configurado.") {
    super(message);
  }
}

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function getStripeApiUrl(path: string) {
  return `${STRIPE_API_URL}${path}`;
}

export function getStripePlanConfig(plan: StripeBillingPlan): StripePlanConfig {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const priceId = plan === "growth" ? process.env.STRIPE_PRICE_GROWTH : process.env.STRIPE_PRICE_SCALE;

  if (!priceId) {
    throw new StripeConfigError(`Configure ${plan === "growth" ? "STRIPE_PRICE_GROWTH" : "STRIPE_PRICE_SCALE"} para ativar este plano.`);
  }

  return {
    priceId,
    successUrl: `${appUrl}/billing?checkout=success`,
    cancelUrl: `${appUrl}/billing?checkout=cancelled`,
  };
}

export function assertStripeConfigured() {
  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    throw new StripeConfigError("Configure STRIPE_SECRET_KEY para ativar Stripe.");
  }

  return secretKey;
}

export function assertStripeWebhookConfigured() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

  if (!webhookSecret) {
    throw new StripeConfigError("Configure STRIPE_WEBHOOK_SECRET para ativar webhook Stripe.");
  }

  return webhookSecret;
}

function parseStripeSignature(signatureHeader: string) {
  return signatureHeader.split(",").reduce(
    (acc, item) => {
      const [key, value] = item.split("=");
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] },
  );
}

export function verifyStripeWebhookSignature(payload: string, signatureHeader: string) {
  const webhookSecret = assertStripeWebhookConfigured();
  const parsed = parseStripeSignature(signatureHeader);

  if (!parsed.timestamp || parsed.signatures.length === 0) {
    return false;
  }

  const signedPayload = `${parsed.timestamp}.${payload}`;
  const expected = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return parsed.signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  });
}

export async function stripeFormRequest<T>(path: string, params: URLSearchParams) {
  const secretKey = assertStripeConfigured();

  const response = await fetch(getStripeApiUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const data = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new StripeConfigError(data.error?.message ?? "Stripe retornou erro na operacao.");
  }

  return data;
}
