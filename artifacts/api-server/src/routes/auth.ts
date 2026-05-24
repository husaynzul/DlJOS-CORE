import { Router } from "express";
import { db } from "@workspace/db";
import { platformTokensTable, platformsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt } from "../lib/crypto";

const router = Router();

interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: Record<string, string>;
  clientId: string | undefined;
  clientSecret: string | undefined;
}

const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: {
      YouTube: "https://www.googleapis.com/auth/youtube",
      "Google Ads": "https://www.googleapis.com/auth/adwords",
    },
    clientId: process.env["GOOGLE_CLIENT_ID"],
    clientSecret: process.env["GOOGLE_CLIENT_SECRET"],
  },
  meta: {
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: {
      Facebook: "pages_manage_posts,pages_read_engagement,pages_show_list",
      Instagram: "instagram_basic,instagram_content_publish,pages_show_list",
      "Meta Ads": "ads_management,ads_read,business_management",
    },
    clientId: process.env["META_CLIENT_ID"],
    clientSecret: process.env["META_CLIENT_SECRET"],
  },
  tiktok: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: {
      TikTok: "user.info.basic,video.list,video.upload",
    },
    clientId: process.env["TIKTOK_CLIENT_KEY"],
    clientSecret: process.env["TIKTOK_CLIENT_SECRET"],
  },
  shopify: {
    authUrl: "",
    tokenUrl: "",
    scopes: {
      Shopify: "read_products,write_products,read_orders,write_orders",
    },
    clientId: process.env["SHOPIFY_API_KEY"],
    clientSecret: process.env["SHOPIFY_API_SECRET"],
  },
};

const pendingStates = new Map<string, { platformId: number; provider: string; shop?: string; expiresAt: number }>();

function getPublicBase(req: { secure?: boolean; get(h: string): string | undefined }): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]}`;
  const host = req.get("host") ?? "localhost:80";
  return `${req.secure ? "https" : "http"}://${host}`;
}

function popupHtml(data: Record<string, string>): string {
  return `<!DOCTYPE html><html><body><script>
    try{window.opener?.postMessage(${JSON.stringify(data)},'*');}catch(e){}
    window.close();
  </script><p>You may close this window.</p></body></html>`;
}

router.get("/auth/providers", (_req, res) => {
  const result: Record<string, boolean> = {};
  for (const [key, cfg] of Object.entries(OAUTH_CONFIGS)) {
    result[key] = !!(cfg.clientId && cfg.clientSecret);
  }
  res.json(result);
});

router.get("/auth/connect/:provider", async (req, res) => {
  const { provider } = req.params;
  const platformId = parseInt(req.query["platformId"] as string);
  const shop = req.query["shop"] as string | undefined;

  if (!platformId || isNaN(platformId)) {
    res.status(400).json({ error: "platformId required" });
    return;
  }

  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }

  if (!config.clientId || !config.clientSecret) {
    res.send(popupHtml({ type: "oauth-error", error: "not_configured", provider }));
    return;
  }

  const nonce = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  pendingStates.set(nonce, { platformId, provider, shop, expiresAt: Date.now() + 10 * 60_000 });

  const base = getPublicBase(req);
  const redirectUri = `${base}/api/auth/callback/${provider}`;
  const state = Buffer.from(JSON.stringify({ nonce })).toString("base64url");

  let authUrl: string;

  if (provider === "shopify") {
    if (!shop) { res.status(400).json({ error: "shop parameter required" }); return; }
    authUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
      client_id: config.clientId, scope: config.scopes["Shopify"] ?? "", redirect_uri: redirectUri, state,
    });
  } else if (provider === "tiktok") {
    authUrl = `https://www.tiktok.com/v2/auth/authorize?` + new URLSearchParams({
      client_key: config.clientId, scope: "user.info.basic,video.list,video.upload",
      response_type: "code", redirect_uri: redirectUri, state,
    });
  } else {
    const platform = await db.select().from(platformsTable).where(eq(platformsTable.id, platformId)).limit(1);
    const platformName = platform[0]?.name ?? "";
    const params: Record<string, string> = {
      client_id: config.clientId, redirect_uri: redirectUri, state, response_type: "code",
    };
    if (provider === "google") {
      params["scope"] = config.scopes[platformName] ?? config.scopes["YouTube"] ?? "";
      params["access_type"] = "offline";
      params["prompt"] = "consent";
    } else {
      params["scope"] = config.scopes[platformName] ?? config.scopes["Facebook"] ?? "";
    }
    authUrl = config.authUrl + "?" + new URLSearchParams(params);
  }

  req.log.info({ provider, platformId }, "OAuth connect");
  res.redirect(authUrl);
});

router.get("/auth/callback/:provider", async (req, res) => {
  const { provider } = req.params;
  const code = req.query["code"] as string;
  const stateParam = req.query["state"] as string;
  const error = req.query["error"] as string;

  if (error) {
    res.send(popupHtml({ type: "oauth-error", error, provider }));
    return;
  }

  if (!code || !stateParam) {
    res.send(popupHtml({ type: "oauth-error", error: "missing_code", provider }));
    return;
  }

  let stateData: { nonce: string };
  try { stateData = JSON.parse(Buffer.from(stateParam, "base64url").toString()); }
  catch { res.send(popupHtml({ type: "oauth-error", error: "invalid_state", provider })); return; }

  const pending = pendingStates.get(stateData.nonce);
  if (!pending || pending.expiresAt < Date.now()) {
    res.send(popupHtml({ type: "oauth-error", error: "state_expired", provider }));
    return;
  }
  pendingStates.delete(stateData.nonce);

  const { platformId, shop } = pending;
  const config = OAUTH_CONFIGS[provider];
  if (!config?.clientId || !config?.clientSecret) {
    res.send(popupHtml({ type: "oauth-error", error: "not_configured", provider }));
    return;
  }

  try {
    const base = getPublicBase(req);
    const redirectUri = `${base}/api/auth/callback/${provider}`;
    let tokenUrl = config.tokenUrl;
    if (provider === "shopify" && shop) tokenUrl = `https://${shop}/admin/oauth/access_token`;

    interface TokenResponse { access_token?: string; refresh_token?: string; expires_in?: number; data?: { access_token?: string; refresh_token?: string; expires_in?: number } }

    let tokenData: TokenResponse;
    if (provider === "tiktok") {
      const body = new URLSearchParams({ client_key: config.clientId, client_secret: config.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri });
      const resp = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
      const json = await resp.json() as TokenResponse;
      tokenData = json.data ?? json;
    } else {
      const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri });
      const resp = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
      tokenData = await resp.json() as TokenResponse;
    }

    if (!tokenData?.access_token) {
      req.log.warn({ provider, platformId, tokenData }, "Token exchange failed");
      res.send(popupHtml({ type: "oauth-error", error: "token_exchange_failed", provider }));
      return;
    }

    const encAccess = encrypt(tokenData.access_token);
    const encRefresh = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null;
    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;

    await db.delete(platformTokensTable).where(eq(platformTokensTable.platformId, platformId));
    await db.insert(platformTokensTable).values({ platformId, provider, accessToken: encAccess, refreshToken: encRefresh, expiresAt: expiresAt ?? undefined });
    await db.update(platformsTable).set({ status: "connected", lastSync: new Date() }).where(eq(platformsTable.id, platformId));

    req.log.info({ provider, platformId }, "OAuth token stored");
    res.send(popupHtml({ type: "oauth-success", provider, platformId: String(platformId) }));
  } catch (err) {
    req.log.error({ provider, platformId, err }, "OAuth callback error");
    res.send(popupHtml({ type: "oauth-error", error: "server_error", provider }));
  }
});

router.delete("/auth/token/:platformId", async (req, res) => {
  const platformId = parseInt(req.params["platformId"] ?? "");
  if (!platformId || isNaN(platformId)) { res.status(400).json({ error: "invalid platformId" }); return; }
  await db.delete(platformTokensTable).where(eq(platformTokensTable.platformId, platformId));
  await db.update(platformsTable).set({ status: "disconnected", accountName: null }).where(eq(platformsTable.id, platformId));
  res.json({ success: true });
});

export default router;
