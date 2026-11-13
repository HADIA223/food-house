import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const seedProductsPath = path.join(serverDirectory, "products.json");
const filePath = process.env.PRODUCTS_FILE ? path.resolve(process.env.PRODUCTS_FILE) : null;
const distPath = path.resolve(serverDirectory, "../dist");
const isProduction = process.env.NODE_ENV === "production";
const categories = ["Burgers", "Pizza", "Sides", "Pasta", "Salads", "Desserts"];

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PRODUCTS_KEY = "restaurant:products";

/* ---------- Storage: Redis (Vercel) -> file (Render/local) -> read-only seed ---------- */

async function redis(command) {
  const res = await fetch(redisUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `Redis error ${res.status}`);
  return data.result;
}

const readSeed = async () => JSON.parse(await fs.readFile(seedProductsPath, "utf8"));

async function readProducts() {
  if (redisUrl && redisToken) {
    const stored = await redis(["GET", PRODUCTS_KEY]);
    if (stored) return JSON.parse(stored);
    const seed = await readSeed();
    await redis(["SET", PRODUCTS_KEY, JSON.stringify(seed)]);
    return seed;
  }
  if (filePath) {
    try {
      return JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const seed = await readSeed();
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(seed, null, 2));
      return seed;
    }
  }
  return readSeed();
}

class StorageNotConfigured extends Error {}

async function writeProducts(products) {
  if (redisUrl && redisToken) return void (await redis(["SET", PRODUCTS_KEY, JSON.stringify(products)]));
  if (filePath) {
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(products, null, 2)}\n`);
    return void (await fs.rename(tmp, filePath));
  }
  if (!isProduction) {
    // local dev: write straight to the seed file
    return void (await fs.writeFile(seedProductsPath, `${JSON.stringify(products, null, 2)}\n`));
  }
  throw new StorageNotConfigured();
}

/* ---------- Stateless signed-cookie session (works on serverless) ---------- */

const COOKIE = "restaurant-admin";
const SESSION_MS = 8 * 60 * 60 * 1000;
const secret = () => process.env.SESSION_SECRET || (isProduction ? "" : "dev-only-secret");
const sign = (value) => crypto.createHmac("sha256", secret()).update(value).digest("base64url");

function createToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function isValidToken(token) {
  if (!token || !secret()) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function getCookie(request, name) {
  const header = request.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

const cookieFlags = `Path=/; HttpOnly; SameSite=Lax${isProduction ? "; Secure" : ""}`;
const isAdmin = (request) => isValidToken(getCookie(request, COOKIE));

function requireAdmin(request, response, next) {
  if (isAdmin(request)) return next();
  return response.status(401).json({ error: "Admin sign-in required." });
}

/* ---------- App ---------- */

const app = express();
if (isProduction) app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));

app.get("/api/products", async (_req, res, next) => {
  try {
    res.json(await readProducts());
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/session", (req, res) => {
  res.json({ authenticated: isAdmin(req) });
});

app.post("/api/admin/login", (req, res) => {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !secret()) {
    return res.status(503).json({
      error: "Server is missing ADMIN_USERNAME, ADMIN_PASSWORD or SESSION_SECRET environment variables.",
    });
  }
  const { username, password } = req.body || {};
  const safeEqual = (a, b) => {
    const x = crypto.createHash("sha256").update(String(a)).digest();
    const y = crypto.createHash("sha256").update(String(b)).digest();
    return crypto.timingSafeEqual(x, y);
  };
  if (!safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(createToken())}; Max-Age=${SESSION_MS / 1000}; ${cookieFlags}`);
  res.json({ authenticated: true });
});

app.post("/api/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0; ${cookieFlags}`);
  res.json({ authenticated: false });
});

app.post("/api/products", requireAdmin, async (req, res, next) => {
  const { name, price, category, description, image } = req.body || {};
  const parsedPrice = Number(price);
  let imageUrl;
  try {
    imageUrl = new URL(image);
  } catch {
    return res.status(400).json({ error: "Enter a valid image URL." });
  }
  if (
    typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
    !Number.isFinite(parsedPrice) || parsedPrice <= 0 ||
    !categories.includes(category) ||
    typeof description !== "string" || !description.trim() || description.trim().length > 500 ||
    !["http:", "https:"].includes(imageUrl.protocol)
  ) {
    return res.status(400).json({ error: "Check the product details and try again." });
  }
  try {
    const products = await readProducts();
    const product = {
      id: crypto.randomUUID(),
      name: name.trim(),
      price: parsedPrice,
      category,
      description: description.trim(),
      image: imageUrl.href,
    };
    products.push(product);
    await writeProducts(products);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:id", requireAdmin, async (req, res, next) => {
  try {
    const products = await readProducts();
    const remaining = products.filter((p) => String(p.id) !== req.params.id);
    if (remaining.length === products.length) {
      return res.status(404).json({ error: "Product not found." });
    }
    await writeProducts(remaining);
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));

// Static frontend (used by Render / local `npm start`; Vercel serves dist itself)
app.use(express.static(distPath));
app.get(/.*/, (_req, res) => res.sendFile(path.join(distPath, "index.html")));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof StorageNotConfigured) {
    return res.status(503).json({
      error: "No database connected. Add an Upstash Redis store in Vercel (Storage tab) and redeploy.",
    });
  }
  res.status(500).json({ error: "An unexpected server error occurred." });
});

export default app;
