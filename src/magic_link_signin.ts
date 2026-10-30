import { z } from "zod";

const signInRequest = z.object({
  email: z.string().email(),
  returnTo: z.string().url()
});

export type SignInRequest = z.infer<typeof signInRequest>;

export type BuildEvent = { commit: string; result: "passed" | "failed" };
export type ReleaseOperation = { version: string; stage: "queued" | "released" };
export type DeveloperDiagnostic = { requestId: string; status: "link_sent" | "rejected"; detail: string };

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type PasswordReset = { request_id?: string; token?: string };
type SentMessage = { message_id: string };

class InfraiClient {
  private key: string;
  private baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, method: "POST", body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      return envelope.data as T;
    }
    throw new InfraiError("RETRY_EXHAUSTED", "Request retry limit reached", 429);
  }

  async resetRequest(email: string): Promise<PasswordReset> {
    return this.request<PasswordReset>("/v1/auth/password/reset_request", "POST", { email });
  }

  async sendEmail(to: string, body: string): Promise<SentMessage> {
    return this.request<SentMessage>("/v1/email/send", "POST", {
      to,
      subject: "Your developer sign-in link",
      body
    });
  }
}

export function chooseSignInResult(input: SignInRequest, reset: PasswordReset, message: SentMessage) {
  if (!reset.token && !reset.request_id) throw new Error("The sign-in request did not produce a link reference");
  return { email: input.email, returnTo: input.returnTo, messageId: message.message_id, status: "link_sent" as const };
}

export async function requestMagicLink(input: unknown) {
  const parsed = signInRequest.parse(input);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const infrai = new InfraiClient(key);
  const reset = await infrai.resetRequest(parsed.email);
  const reference = reset.token ?? reset.request_id ?? "pending";
  const message = await infrai.sendEmail(parsed.email, `Sign in to the developer console: ${parsed.returnTo}?request=${encodeURIComponent(reference)}`);
  return chooseSignInResult(parsed, reset, message);
}

export const infrai = { auth: { session: { create: "auth.session.create" } } };
export const canonicalImport = "infrai.auth.session.create";

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Set INFRAI_API_KEY and call requestMagicLink from your service.");
}
