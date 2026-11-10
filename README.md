# Restaurant System

## Setup

Install dependencies and create the server configuration file:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and set a private admin username, password, and a long random `SESSION_SECRET`. These values are read only by the server and are not included in the browser bundle.

## Run locally

```powershell
npm run dev
```

Vite runs the site and proxies `/api` requests to the local Node server. Sign in at `/admin`; only the configured admin session can add or delete products. Product changes are saved in `server/products.json`.

## Deploy to Render

1. Push the project to a GitHub repository. Do not commit `.env`; it is ignored by Git.
2. In Render, create a new Blueprint and connect the repository. Render reads `render.yaml` to build the app and attach persistent product storage. Choose a service plan that supports persistent disks.
3. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the Render service's environment settings. The Blueprint generates `SESSION_SECRET`.
4. After deployment, open the public service URL and add `/admin` to sign in.

The deployed site keeps running while your computer is off. Product changes are stored on the hosting disk.

## Production

Build and run the Node server:

```powershell
npm run build
npm start
```

Set `NODE_ENV=production` and configure `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in the hosting environment. Serve the app over HTTPS in production. The included session store is intended for a single server instance; use a persistent session store such as Redis when deploying multiple instances.
