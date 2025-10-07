# HAEVN MVP - Deployment Guide

## Prerequisites

- Vercel account (free tier works)
- Supabase project with database migrations applied
- GitHub repository access

## Environment Variables

Configure the following environment variables in Vercel:

### Required Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
```

### Where to Find These Values

1. **Supabase URL & Anon Key**:
   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy "Project URL" and "anon public" key

2. **Service Role Key**:
   - Same location as above
   - Copy "service_role" key (keep this secret!)

3. **Site URL**:
   - After deploying to Vercel, use your Vercel domain
   - During setup, use: `https://your-project.vercel.app`

## Database Setup

Ensure all migrations have been run in Supabase:

1. Go to Supabase Dashboard > SQL Editor
2. Run migrations in order:
   - `001_initial_schema.sql`
   - `002_partnership_members.sql`
   - `003_partnership_profiles.sql`
   - ... (all through `011_partnership_invites.sql`)

## Storage Setup

Ensure the `avatars` bucket is configured:

1. Go to Supabase Dashboard > Storage
2. Create bucket named `avatars` (if not exists)
3. Set bucket to **public**
4. Configure RLS policies for photo uploads

## Vercel Deployment Steps

### Option 1: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure environment variables (see above)
5. Click "Deploy"

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE
vercel env add NEXT_PUBLIC_SITE_URL

# Deploy to production
vercel --prod
```

## Post-Deployment Checklist

- [ ] Verify environment variables are set correctly
- [ ] Test authentication flow (signup/login)
- [ ] Test partner profile page loads
- [ ] Test partnership invitation system
- [ ] Test photo upload functionality
- [ ] Test match viewing on dashboard
- [ ] Verify Supabase RLS policies are working
- [ ] Check browser console for errors

## Troubleshooting

### Authentication Issues

If users can't sign up/login:
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Verify Supabase Auth is enabled
- Check redirect URLs in Supabase Auth settings

### Database Connection Issues

If data isn't loading:
- Verify `SUPABASE_SERVICE_ROLE` is correct
- Check RLS policies in Supabase
- Run migrations if database schema is outdated

### Photo Upload Issues

If photo uploads fail:
- Check storage bucket `avatars` exists and is public
- Verify RLS policies on storage bucket
- Check `SUPABASE_SERVICE_ROLE` has proper permissions

## Build Warnings

The build shows warnings about Edge Runtime and Node.js APIs from Supabase packages. These are expected and don't affect functionality:

```
⚠ A Node.js API is used (process.versions) which is not supported in the Edge Runtime.
```

These warnings come from Supabase's realtime features and can be safely ignored for this MVP.

## Performance Monitoring

After deployment, monitor:
- Response times in Vercel Analytics
- Database query performance in Supabase Dashboard
- Error logs in Vercel Logs

## Rollback Plan

If issues arise:
1. Go to Vercel Dashboard > Deployments
2. Find previous working deployment
3. Click "..." > "Promote to Production"

## Support

For deployment issues:
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
