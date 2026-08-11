# Local Development Setup Guide

This guide will help you set up your local environment to test the app with Netlify Functions and Neon Database.

## Step 1: Get Environment Variables from Netlify

1. Go to your **Netlify Dashboard**: https://app.netlify.com
2. Select your site (HisaabKitaab)
3. Go to **Site settings** → **Environment variables**
4. You need to copy these two values:

   - `ADMIN_PASSWORD_HASH` - The SHA-256 hash of your admin password
   - `NEON_CONNECTION_STRING` - Your Neon PostgreSQL connection string
     (It might also be named `NETLIFY_DB_URL` or `NETLIFY_DATABASE_URL`)

5. **Copy both values** - you'll need them in the next step

## Step 2: Create .env File

1. In your project root directory (`D:\Personal\Projects\DaK - Accounting Software\HisaabKitaab`), create a new file named `.env`

2. Open the `.env` file and add your environment variables:

```
ADMIN_PASSWORD_HASH=your_sha256_hash_here
NEON_CONNECTION_STRING=postgresql://user:password@host/database?sslmode=require
```

3. **Replace the values** with the ones you copied from Netlify:
   - Replace `your_sha256_hash_here` with your actual `ADMIN_PASSWORD_HASH`
   - Replace `postgresql://user:password@host/database?sslmode=require` with your actual `NEON_CONNECTION_STRING`

**Important:** The `.env` file is already added to `.gitignore`, so it won't be committed to Git.

## Step 3: Run Local Development Server

Instead of running `npm run dev` (which only runs Vite), you need to run:

```powershell
npm run dev:netlify
```

This will:
- Start the Vite dev server (your React app)
- Start the Netlify Functions locally
- Make your environment variables available to the functions
- Proxy requests to `/.netlify/functions/*` to the local functions

## Step 4: Test Your Setup

1. The dev server will start on `http://localhost:8888` (or another port if 8888 is busy)
2. Open your browser and go to that URL
3. Try logging in with your admin password
4. The login should work because it's using the same `ADMIN_PASSWORD_HASH` from Netlify
5. All database operations will use your Neon database

## Troubleshooting

### Issue: "Incorrect password"
- **Check:** Make sure your `.env` file has the correct `ADMIN_PASSWORD_HASH` value
- **Check:** Make sure there are no extra spaces or quotes around the values in `.env`
- **Solution:** The hash should be exactly the same as in Netlify (no quotes, no spaces)

### Issue: "Database connection string is not configured"
- **Check:** Make sure your `.env` file has `NEON_CONNECTION_STRING` set
- **Check:** Make sure the connection string is valid (starts with `postgresql://`)
- **Solution:** Copy the exact value from Netlify environment variables

### Issue: "Port already in use"
- **Solution:** Netlify Dev will try a different port automatically, or you can specify one:
  ```powershell
  netlify dev --port 3000
  ```

### Issue: Functions not working
- **Check:** Make sure you're using `npm run dev:netlify` and NOT `npm run dev`
- **Check:** The terminal should show "Functions server is listening on port XXXX"
- **Solution:** `npm run dev` only runs Vite, it doesn't run Netlify Functions

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm run dev` | Runs only Vite (React app) - **Functions won't work** |
| `npm run dev:netlify` | Runs Vite + Netlify Functions - **Use this for full testing** |
| `npm run build` | Builds for production |

## Security Notes

- ✅ The `.env` file is already in `.gitignore` - it won't be committed
- ⚠️ Never share your `.env` file or commit it to Git
- ⚠️ Never share your `ADMIN_PASSWORD_HASH` or database connection string publicly




