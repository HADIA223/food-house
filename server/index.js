import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const seedProductsPath = path.join(serverDirectory, "products.json");
const productsPath = process.env.PRODUCTS_FILE
  ? path.resolve(process.env.PRODUCTS_FILE)
  : seedProductsPath;
const distPath = path.resolve(serverDirectory, "../dist");
const port = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const categories = ["Burgers", "Pizza", "Sides", "Pasta", "Salads", "Desserts"];

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be configured in production.");
}

const app = express();

if (isProduction) app.set("trust proxy", 1);

app.use(express.json({ limit: "20kb" }));
app.use(session({
  name: "restaurant-admin",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

function requireAdmin(request, response, next) {
  if (request.session.isAdmin) return next();
  return response.status(401).json({ error: "Admin sign-in required." });
}

async function readProducts() {
  return JSON.parse(await fs.readFile(productsPath, "utf8"));
}

async function writeProducts(products) {
  const temporaryPath = `${productsPath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(products, null, 2)}\n`);
  await fs.rename(temporaryPath, productsPath);
}

async function ensureProductsFile() {
  await fs.mkdir(path.dirname(productsPath), { recursive: true });
  try {
    await fs.access(productsPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.copyFile(seedProductsPath, productsPath);
  }
}

app.get("/api/products", async (_request, response, next) => {
  try {
    response.json(await readProducts());
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/session", (request, response) => {
  response.json({ authenticated: Boolean(request.session.isAdmin) });
});

app.post("/api/admin/login", async (request, response, next) => {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return response.status(503).json({ error: "Admin credentials are not configured on the server." });
  }

  const { username, password } = request.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return response.status(401).json({ error: "Incorrect username or password." });
  }

  try {
    await new Promise((resolve, reject) => {
      request.session.regenerate((error) => error ? reject(error) : resolve());
    });
    request.session.isAdmin = true;
    response.json({ authenticated: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/logout", (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie("restaurant-admin", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    });
    response.json({ authenticated: false });
  });
});

app.post("/api/products", requireAdmin, async (request, response, next) => {
  const { name, price, category, description, image } = request.body || {};
  const parsedPrice = Number(price);
  let imageUrl;

  try {
    imageUrl = new URL(image);
  } catch {
    return response.status(400).json({ error: "Enter a valid image URL." });
  }

  if (
    typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
    !Number.isFinite(parsedPrice) || parsedPrice <= 0 ||
    !categories.includes(category) ||
    typeof description !== "string" || !description.trim() || description.trim().length > 500 ||
    !["http:", "https:"].includes(imageUrl.protocol)
  ) {
    return response.status(400).json({ error: "Check the product details and try again." });
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
    response.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:id", requireAdmin, async (request, response, next) => {
  try {
    const products = await readProducts();
    const remaining = products.filter((product) => String(product.id) !== request.params.id);
    if (remaining.length === products.length) {
      return response.status(404).json({ error: "Product not found." });
    }
    await writeProducts(remaining);
    response.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "API route not found." });
});

app.use(express.static(distPath));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distPath, "index.html"));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "An unexpected server error occurred." });
});

ensureProductsFile()
  .then(() => {
    app.listen(port, () => {
      console.log(`Restaurant server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Unable to initialize the product store:", error);
    process.exitCode = 1;
  });
