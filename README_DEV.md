# HAEVN Development Utilities

**⚠️ WARNING: These endpoints are DEV-ONLY and will not work in production!**

This document describes development-only API endpoints for testing HAEVN features locally.

## Prerequisites

1. Database migrations applied (see README_DB.md)
2. Environment variables configured (.env.local)
3. Development server running (`npm run dev`)
4. User authenticated (for some endpoints)

## Available Dev Endpoints

### 1. Flip City Status
Toggle a city between LIVE and WAITLIST status.

**Endpoint:** `POST /api/dev/flip-city`

**Body:**
```json
{
  "city": "Austin",
  "isLive": true
}
```

**Example - Make Austin LIVE:**
```bash
curl -X POST http://localhost:3000/api/dev/flip-city \
  -H "Content-Type: application/json" \
  -d '{"city": "Austin", "isLive": true}'
```

**Example - Put Chicago on WAITLIST:**
```bash
curl -X POST http://localhost:3000/api/dev/flip-city \
  -H "Content-Type: application/json" \
  -d '{"city": "Chicago", "isLive": false}'
```

### 2. Seed Development Data
Creates test data for the currently authenticated user.

**Endpoint:** `POST /api/dev/seed`

**Requirements:** Must be logged in

**Creates:**
- User profile
- Partnership owned by you
- Partnership membership
- Survey response (25% complete)
- Demo partnership "B-Unit" for testing discovery

**Example:**
```bash
# First, log in via the UI at http://localhost:3000/auth/signup
# Then run:
curl -X POST http://localhost:3000/api/dev/seed \
  -H "Content-Type: application/json" \
  --cookie "your-session-cookies"
```

**Browser Console (easier):**
```javascript
// After logging in, open browser console and run:
fetch('/api/dev/seed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(console.log)
```

### 3. Force Handshake
Create a handshake (mutual match) between two partnerships.

**Endpoint:** `POST /api/dev/force-handshake`

**Requirements:**
- Must be logged in
- Must be a member of at least one partnership

**Body:**
```json
{
  "a_partnership_id": "uuid-of-partnership-a",
  "b_partnership_id": "uuid-of-partnership-b"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/dev/force-handshake \
  -H "Content-Type: application/json" \
  -d '{
    "a_partnership_id": "YOUR_PARTNERSHIP_ID",
    "b_partnership_id": "DEMO_PARTNERSHIP_ID"
  }' \
  --cookie "your-session-cookies"
```

**Browser Console:**
```javascript
// Get partnership IDs from the seed response, then:
fetch('/api/dev/force-handshake', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    a_partnership_id: 'YOUR_ID',
    b_partnership_id: 'DEMO_ID'
  })
}).then(r => r.json()).then(console.log)
```

## Quick Start Workflow

1. **Start the app:**
   ```bash
   npm run dev
   ```

2. **Sign up as a new user:**
   - Navigate to http://localhost:3000
   - Click "Join Waitlist" or "Sign In"
   - Create an account

3. **Seed your dev data:**
   ```javascript
   // In browser console:
   const seed = await fetch('/api/dev/seed', { method: 'POST' }).then(r => r.json())
   console.log('Your partnership:', seed.data.userPartnership.id)
   console.log('Demo partnership:', seed.data.demoPartnership.id)
   ```

4. **Make your city LIVE (if needed):**
   ```javascript
   // In browser console:
   await fetch('/api/dev/flip-city', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ city: 'New York', isLive: true })
   }).then(r => r.json())
   ```

5. **Create a test handshake:**
   ```javascript
   // Use IDs from step 3
   await fetch('/api/dev/force-handshake', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       a_partnership_id: seed.data.userPartnership.id,
       b_partnership_id: seed.data.demoPartnership.id
     })
   }).then(r => r.json())
   ```

## Viewing Endpoint Documentation

Each endpoint supports GET requests to view its documentation:

```bash
curl http://localhost:3000/api/dev/flip-city
curl http://localhost:3000/api/dev/seed
curl http://localhost:3000/api/dev/force-handshake
```

## Troubleshooting

### "This endpoint is only available in development"
- Ensure `NODE_ENV` is not set to 'production'
- Check you're running `npm run dev`, not `npm run build && npm start`

### "You must be logged in"
- Sign up/sign in first at http://localhost:3000/auth/signup
- Use browser console for easier authenticated requests

### "One or both partnerships do not exist"
- Run the seed endpoint first to create partnerships
- Check the returned IDs from the seed response

### Database errors
- Ensure migrations are applied (see README_DB.md)
- Check Supabase connection in .env.local
- Verify at http://localhost:3000/dev/health

## Security Note

These endpoints are protected by `NODE_ENV` checks and will return 403 Forbidden in production. Never attempt to use these in a production environment.