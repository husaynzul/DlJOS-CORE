import { Router } from "express";
import crypto from "crypto";

const router = Router();

// ── Real exchange validation calls ────────────────────────────────────────────

async function validateBinance(apiKey: string, secretKey: string): Promise<{ ok: boolean; accountName?: string; error?: string }> {
  try {
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = crypto.createHmac("sha256", secretKey).update(query).digest("hex");
    const res = await fetch(`https://api.binance.com/api/v3/account?${query}&signature=${signature}`, {
      headers: { "X-MBX-APIKEY": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json() as { accountType?: string; balances?: unknown[]; code?: number; msg?: string };
    if (!res.ok || json.code) return { ok: false, error: json.msg ?? `HTTP ${res.status}` };
    return { ok: true, accountName: `Binance ${json.accountType ?? "Account"}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

async function validateBybit(apiKey: string, secretKey: string): Promise<{ ok: boolean; accountName?: string; error?: string }> {
  try {
    const timestamp = Date.now().toString();
    const recv = "5000";
    const paramStr = timestamp + apiKey + recv;
    const sign = crypto.createHmac("sha256", secretKey).update(paramStr).digest("hex");
    const res = await fetch("https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED", {
      headers: { "X-BAPI-API-KEY": apiKey, "X-BAPI-TIMESTAMP": timestamp, "X-BAPI-SIGN": sign, "X-BAPI-RECV-WINDOW": recv },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json() as { retCode?: number; retMsg?: string };
    if (!res.ok || json.retCode !== 0) return { ok: false, error: json.retMsg ?? `HTTP ${res.status}` };
    return { ok: true, accountName: "Bybit Unified Account" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

async function validateKuCoin(apiKey: string, secretKey: string, passphrase: string): Promise<{ ok: boolean; accountName?: string; error?: string }> {
  try {
    const timestamp = Date.now().toString();
    const path = "/api/v1/accounts";
    const strToSign = timestamp + "GET" + path;
    const sign = crypto.createHmac("sha256", secretKey).update(strToSign).digest("base64");
    const encPass = crypto.createHmac("sha256", secretKey).update(passphrase).digest("base64");
    const res = await fetch(`https://api.kucoin.com${path}`, {
      headers: { "KC-API-KEY": apiKey, "KC-API-SIGN": sign, "KC-API-TIMESTAMP": timestamp, "KC-API-PASSPHRASE": encPass, "KC-API-KEY-VERSION": "2" },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json() as { code?: string; msg?: string };
    if (!res.ok || json.code !== "200000") return { ok: false, error: json.msg ?? `HTTP ${res.status}` };
    return { ok: true, accountName: "KuCoin Account" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

async function validateOKX(apiKey: string, secretKey: string, passphrase: string): Promise<{ ok: boolean; accountName?: string; error?: string }> {
  try {
    const timestamp = new Date().toISOString();
    const path = "/api/v5/account/balance";
    const sign = crypto.createHmac("sha256", secretKey).update(timestamp + "GET" + path).digest("base64");
    const res = await fetch(`https://www.okx.com${path}`, {
      headers: { "OK-ACCESS-KEY": apiKey, "OK-ACCESS-SIGN": sign, "OK-ACCESS-TIMESTAMP": timestamp, "OK-ACCESS-PASSPHRASE": passphrase },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json() as { code?: string; msg?: string };
    if (!res.ok || json.code !== "0") return { ok: false, error: json.msg ?? `HTTP ${res.status}` };
    return { ok: true, accountName: "OKX Account" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

async function validateBitget(apiKey: string, secretKey: string, passphrase: string): Promise<{ ok: boolean; accountName?: string; error?: string }> {
  try {
    const timestamp = Date.now().toString();
    const path = "/api/v2/account/info";
    const sign = crypto.createHmac("sha256", secretKey).update(timestamp + "GET" + path).digest("base64");
    const res = await fetch(`https://api.bitget.com${path}`, {
      headers: { "ACCESS-KEY": apiKey, "ACCESS-SIGN": sign, "ACCESS-TIMESTAMP": timestamp, "ACCESS-PASSPHRASE": passphrase, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json() as { code?: string; msg?: string };
    if (!res.ok || json.code !== "00000") return { ok: false, error: json.msg ?? `HTTP ${res.status}` };
    return { ok: true, accountName: "Bitget Account" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

async function validateCoinbase(apiKey: string, secretKey: string): Promise<{ ok: boolean; accountName?: string; error?: string }> {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = "/v2/user";
    const sign = crypto.createHmac("sha256", secretKey).update(timestamp + "GET" + path).digest("hex");
    const res = await fetch(`https://api.coinbase.com${path}`, {
      headers: { "CB-ACCESS-KEY": apiKey, "CB-ACCESS-SIGN": sign, "CB-ACCESS-TIMESTAMP": timestamp },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json() as { data?: { name?: string; email?: string }; errors?: { id?: string; message?: string }[] };
    if (!res.ok || json.errors?.length) return { ok: false, error: json.errors?.[0]?.message ?? `HTTP ${res.status}` };
    return { ok: true, accountName: json.data?.name ?? json.data?.email ?? "Coinbase Account" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

async function validateGoogle(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=${apiKey}`, {
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.status !== 403 && res.status !== 401 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/validate/platform", async (req, res) => {
  const { platformId, apiKey, secretKey, passphrase } = req.body as {
    platformId: string;
    apiKey?: string;
    secretKey?: string;
    passphrase?: string;
  };

  if (!platformId || !apiKey) {
    res.status(400).json({ ok: false, error: "platformId and apiKey are required" });
    return;
  }

  let result: { ok: boolean; accountName?: string; error?: string };

  switch (platformId.toLowerCase()) {
    case "binance":
      if (!secretKey) { res.json({ ok: false, error: "Secret key required" }); return; }
      result = await validateBinance(apiKey, secretKey);
      break;
    case "bybit":
      if (!secretKey) { res.json({ ok: false, error: "Secret key required" }); return; }
      result = await validateBybit(apiKey, secretKey);
      break;
    case "kucoin":
      if (!secretKey || !passphrase) { res.json({ ok: false, error: "Secret key and passphrase required" }); return; }
      result = await validateKuCoin(apiKey, secretKey, passphrase);
      break;
    case "okx":
      if (!secretKey || !passphrase) { res.json({ ok: false, error: "Secret key and passphrase required" }); return; }
      result = await validateOKX(apiKey, secretKey, passphrase);
      break;
    case "bitget":
      if (!secretKey || !passphrase) { res.json({ ok: false, error: "Secret key and passphrase required" }); return; }
      result = await validateBitget(apiKey, secretKey, passphrase);
      break;
    case "coinbase":
      if (!secretKey) { res.json({ ok: false, error: "Secret key required" }); return; }
      result = await validateCoinbase(apiKey, secretKey);
      break;
    default:
      result = { ok: true, accountName: `${platformId} Account` };
  }

  res.json(result);
});

export default router;
