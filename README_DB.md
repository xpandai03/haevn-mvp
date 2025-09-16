# HAEVN Database Setup Guide

## Overview
This document explains how to set up the HAEVN database schema in Supabase.

## Database Structure

### Core Tables
- **profiles** - User profile data extending auth.users
- **partnerships** - Group profiles for couples/throuples
- **partnership_members** - Links users to partnerships
- **survey_responses** - Survey data per partnership
- **city_status** - Tracks which cities are live vs waitlist
- **signals** - One-way likes between partnerships
- **handshakes** - Mutual matches (created automatically)
- **messages** - Chat messages between matched partnerships
- **subscriptions** - User billing/subscription info

### Key Features
- Automatic handshake creation when mutual signals exist
- Automatic profile and subscription creation on user signup
- Row Level Security (RLS) on all tables
- Proper foreign key relationships and constraints

## How to Apply Migrations

### Step 1: Access Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor (left sidebar)
3. Click "New query"

### Step 2: Run Migration Files
Run these migrations **in order**:

#### Migration 1: Create Tables (001_init.sql)
1. Copy the entire contents of `supabase/migrations/001_init.sql`
2. Paste into the SQL Editor
3. Click "Run" or press Cmd/Ctrl + Enter
4. Wait for success message

#### Migration 2: Enable RLS Policies (002_policies.sql)
1. Copy the entire contents of `supabase/migrations/002_policies.sql`
2. Paste into the SQL Editor
3. Click "Run" or press Cmd/Ctrl + Enter
4. Wait for success message

### Step 3: Verify Installation
Run this query to verify all tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- city_status
- handshakes
- messages
- partnership_members
- partnerships
- profiles
- signals
- subscriptions
- survey_responses

### Step 4: Verify RLS is Enabled
Run this query to confirm RLS is active:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should show `rowsecurity = true`.

## Important Notes

### About RLS Policies
- **profiles**: Users can only see/edit their own profile
- **partnerships**: Members can view, owners can edit
- **survey_responses**: Partnership members can view/edit
- **signals**: Users can send from their partnerships
- **handshakes**: Created automatically via trigger
- **messages**: Only between matched partnerships
- **subscriptions**: Users manage their own

### Automatic Features
1. **Profile Creation**: When a user signs up, a profile and subscription record are automatically created
2. **Handshake Creation**: When two partnerships signal each other, a handshake is automatically created
3. **Timestamp Updates**: `updated_at` fields are automatically maintained

### Initial Data
The migration includes starter data for cities:
- **Live**: New York, Los Angeles, San Francisco
- **Waitlist**: Chicago, Austin, Miami, Seattle, Boston

## Troubleshooting

### If migrations fail:
1. Check for existing tables: Some tables might already exist
2. Drop all tables and try again:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
   ⚠️ **WARNING**: This will delete ALL data!

### If RLS policies fail:
1. Ensure tables exist first (run 001_init.sql)
2. Check that auth.users table exists
3. Verify no conflicting policies exist

## Next Steps
After database setup:
1. Update `.env.local` with your Supabase credentials
2. Test connection at `http://localhost:3000/dev/health`
3. Generate TypeScript types:
   ```bash
   npx supabase gen types typescript --project-id "your-project-id" > lib/types/supabase.ts
   ```

## Support
For issues or questions about the database schema, check the migration files directly or consult the Supabase documentation.