import { SurveysClient } from '@/components/admin/surveys/SurveysClient'

// Live admin data — never statically cached.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Surveys — HAEVN Admin',
}

export default function SurveysPage() {
  return <SurveysClient />
}
