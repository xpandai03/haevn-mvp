# HAEVN MVP - Social Discovery Platform

A Next.js web application for ethical non-monogamy social discovery, built with modern web technologies and HAEVN brand design system.

## Features

### ✅ Implemented (Oct 2025)

- **Authentication System**
  - Email/password signup and login
  - Secure session management with Supabase Auth
  - Protected routes with middleware

- **Partner Profile**
  - Unified profile and settings page
  - Photo upload with avatar support
  - Bio, relationship goals, communication style
  - Energy archetype display
  - Single-user mode with partnership invitation

- **Partnership System**
  - Invite partner via email
  - Accept invitation with 6-character code
  - Partnership status tracking
  - RLS policies for data security

- **Dashboard**
  - Live match statistics
  - Compatibility-based matching
  - Tier-based match breakdown (Platinum, Gold, Silver, Bronze)
  - Stat cards for Matches, Connections, Nudges

- **Design System**
  - HAEVN brand colors (#008080 teal, #E29E0C orange, #1E2A4A navy)
  - Roboto typography (Light 300, Medium 500, Black 900)
  - Consistent spacing and component styling
  - Responsive layouts

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/xpandai03/haevn-mvp.git
cd HAEVN-STARTER-INTERFACE
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. Run database migrations:
   - Go to Supabase Dashboard > SQL Editor
   - Run migration files in order from `supabase/migrations/`

5. Set up storage:
   - Create `avatars` bucket in Supabase Storage
   - Set bucket to public
   - Configure RLS policies

6. Start development server:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
HAEVN-STARTER-INTERFACE/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main dashboard
│   ├── partner-profile/   # Partner profile page
│   └── onboarding/        # Onboarding flow
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── PartnerProfile.tsx
│   ├── MatchCardSimple.tsx
│   ├── InvitePartnerModal.tsx
│   └── AcceptInviteModal.tsx
├── lib/                   # Utilities and actions
│   ├── actions/          # Server actions
│   ├── auth/             # Auth context
│   ├── supabase/         # Supabase clients
│   └── hooks/            # Custom React hooks
├── supabase/
│   └── migrations/       # Database migrations
├── public/               # Static assets
└── middleware.ts         # Auth middleware
```

## Database Schema

### Core Tables

- `users` - User accounts (Supabase Auth)
- `partnerships` - Partnership entities
- `partnership_members` - User-partnership relationships
- `partnership_profiles` - Partnership profile data
- `partnership_requests` - Partnership invitations
- `match_signals` - User match preferences
- `handshakes` - Match connections

## Key Workflows

### Partnership Invitation Flow

1. User A creates account and partnership
2. User A clicks "Invite Partner" in profile
3. System generates 6-character invite code
4. User A shares code with User B
5. User B creates account and clicks "Accept Invite"
6. User B enters code
7. Users are now connected in partnership

### Matching Algorithm

- Compatibility calculated based on survey responses
- Matches tiered: Platinum (90%+), Gold (75-89%), Silver (60-74%), Bronze (<60%)
- Real-time updates when partnership status changes

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy to Vercel:

```bash
npm i -g vercel
vercel login
vercel
```

## Development

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
npm run start
```

### Code Style

- TypeScript with strict mode
- ESLint configured
- Prettier for formatting
- Tailwind CSS utility-first approach

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE` | Supabase service role key | Yes |
| `NEXT_PUBLIC_SITE_URL` | Application URL | Yes |

## Contributing

1. Create feature branch from `main`
2. Make changes with descriptive commits
3. Test locally
4. Submit pull request

## Roadmap

### Upcoming Features
- [ ] Messaging system
- [ ] Advanced search filters
- [ ] Event calendar
- [ ] Community resources
- [ ] Video verification
- [ ] Push notifications

## License

Proprietary - HAEVN

## Support

For issues or questions:
- GitHub Issues: https://github.com/xpandai03/haevn-mvp/issues
- Email: support@haevn.com
