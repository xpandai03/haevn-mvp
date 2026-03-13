'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, ChevronRight, Shield, Target, Zap, Heart, Compass, Coffee, Info, Sparkles } from 'lucide-react'

// ─── Constants ─────────────────────────────────────────────────────────────

const SPEC_MACRO_WEIGHTS = [
  { key: 'boundaries_comfort', label: 'Boundaries & Comfort', weight: 35, color: 'bg-purple-500', icon: Shield },
  { key: 'sexual_energy', label: 'Sexual Energy', weight: 35, color: 'bg-pink-500', icon: Zap },
  { key: 'openness_curiosity', label: 'Openness & Curiosity', weight: 10, color: 'bg-teal-500', icon: Compass },
  { key: 'structure_fit', label: 'Structure Fit', weight: 10, color: 'bg-blue-500', icon: Target },
  { key: 'goals_expectations', label: 'Goals & Expectations', weight: 10, color: 'bg-amber-500', icon: Sparkles },
]

const PIPELINE_STEPS = [
  {
    label: 'Survey Responses',
    detail: 'Raw answers from the survey responses table (JSONB)',
    type: 'input' as const,
  },
  {
    label: 'Normalization',
    detail: 'INTERNAL_TO_CSV key mapping + ShowIf condition filtering',
    type: 'process' as const,
  },
  {
    label: 'Pair Applicability',
    detail: 'Conditional logic determines which question pairs apply to each user combination',
    type: 'process' as const,
  },
  {
    label: 'Constraint Gates (9)',
    detail: 'Structural, feasibility, and dealbreaker gates filter incompatible pairs',
    type: 'gate' as const,
  },
  {
    label: 'Category Scoring (5)',
    detail: 'Intent 30% / Structure 25% / Connection 20% / Chemistry 15% / Lifestyle 10%',
    type: 'process' as const,
  },
  {
    label: 'Weight Renormalization',
    detail: 'If Lifestyle coverage < 40%, exclude category and redistribute weights',
    type: 'process' as const,
  },
  {
    label: 'Final Score + Tier',
    detail: 'Platinum 80+ / Gold 60-79 / Silver 40-59 / Bronze 0-39',
    type: 'output' as const,
  },
  {
    label: '80% Threshold Filter',
    detail: 'Only scores >= 80 are stored as eligible matches',
    type: 'gate' as const,
  },
  {
    label: 'Match Monday Release',
    detail: 'Weekly visibility release to users',
    type: 'output' as const,
  },
  {
    label: '90-Day Expiration',
    detail: 'Matches auto-expire after 90 days',
    type: 'output' as const,
  },
]

const CONSTRAINT_GATES = [
  { name: 'Core Intent', questions: 'Q9', rule: 'Users must share the same core intent', category: 'structural' as const },
  { name: 'Language', questions: 'Q13a', rule: 'Block if required flag set and no language overlap', category: 'structural' as const },
  { name: 'Mutual Interest', questions: 'Q6b', rule: 'Solo/couple mutual inclusion required', category: 'structural' as const },
  { name: 'Couple Permissions', questions: 'Q6d', rule: 'Couple connection rules must be compatible', category: 'structural' as const },
  { name: 'Age Range', questions: 'Preferences', rule: 'Mutual age preferences must overlap', category: 'feasibility' as const },
  { name: 'Distance Cap', questions: 'Location', rule: 'Geographic proximity check', category: 'feasibility' as const },
  { name: 'Safer-sex', questions: 'Q30, Q30a', rule: 'Block if safer-sex practices are incompatible', category: 'dealbreaker' as const },
  { name: 'Health', questions: 'Q31', rule: 'Testing/disclosure conflicts block match', category: 'dealbreaker' as const },
  { name: 'Hard Boundaries', questions: 'Q28', rule: "User desires can't conflict with match hard-nos", category: 'dealbreaker' as const },
]

const GATE_CATEGORY_STYLES = {
  structural: { label: 'Structural', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  feasibility: { label: 'Feasibility', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  dealbreaker: { label: 'Dealbreaker', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-400' },
}

const STEP_TYPE_STYLES = {
  input: 'bg-purple-100 border-purple-300 text-purple-800',
  process: 'bg-blue-50 border-blue-200 text-blue-800',
  gate: 'bg-amber-50 border-amber-200 text-amber-800',
  output: 'bg-green-50 border-green-200 text-green-800',
}

// ─── Sub-components ────────────────────────────────────────────────────────

function EnginePipeline() {
  return (
    <div className="space-y-0">
      {PIPELINE_STEPS.map((step, i) => (
        <div key={step.label} className="flex items-start gap-3">
          {/* Vertical connector */}
          <div className="flex flex-col items-center w-6 shrink-0">
            <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
              step.type === 'gate' ? 'bg-amber-400' :
              step.type === 'input' ? 'bg-purple-400' :
              step.type === 'output' ? 'bg-green-400' : 'bg-blue-400'
            }`} />
            {i < PIPELINE_STEPS.length - 1 && (
              <div className="w-px h-full min-h-[24px] bg-gray-300" />
            )}
          </div>
          {/* Step content */}
          <div className={`flex-1 mb-2 px-3 py-2 rounded-md border text-sm ${STEP_TYPE_STYLES[step.type]}`}>
            <div className="font-medium">{step.label}</div>
            <div className="text-xs opacity-75 mt-0.5">{step.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MacroWeightBars() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        The HAEVN compatibility engine groups questions into five macro dimensions.
        Each macro is scored from question-level comparisons and then combined using fixed macro weights to produce the final compatibility percentage.
      </p>
      {SPEC_MACRO_WEIGHTS.map(({ key, label, weight, color, icon: Icon }) => (
        <div key={key} className="flex items-center gap-3">
          <div className="flex items-center gap-2 w-44 shrink-0">
            <Icon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </div>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
            <div
              className={`h-full rounded-full ${color} transition-all`}
              style={{ width: `${weight * 2.86}%` }}
            />
          </div>
          <span className="text-sm font-mono text-gray-600 w-10 text-right">{weight}%</span>
        </div>
      ))}
    </div>
  )
}

function GateReference() {
  const grouped = {
    structural: CONSTRAINT_GATES.filter(g => g.category === 'structural'),
    feasibility: CONSTRAINT_GATES.filter(g => g.category === 'feasibility'),
    dealbreaker: CONSTRAINT_GATES.filter(g => g.category === 'dealbreaker'),
  }

  return (
    <div className="space-y-3">
      {(Object.keys(grouped) as Array<keyof typeof grouped>).map(cat => {
        const style = GATE_CATEGORY_STYLES[cat]
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-2 h-2 rounded-full ${style.dot}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${style.text}`}>
                {style.label}
              </span>
            </div>
            <div className="space-y-1">
              {grouped[cat].map(gate => (
                <div key={gate.name} className={`flex items-start gap-3 px-3 py-2 rounded-md border text-sm ${style.bg} ${style.border}`}>
                  <div className="w-32 shrink-0">
                    <span className="font-medium">{gate.name}</span>
                    <span className="text-xs opacity-60 ml-1.5">({gate.questions})</span>
                  </div>
                  <span className="text-xs opacity-80">{gate.rule}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EngineMetadata() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {[
        { label: 'Engine Version', value: '5cat-v4' },
        { label: 'Next Engine Spec', value: 'Gate & Weight Model (March 2026)' },
        { label: 'Categories', value: '5' },
        { label: 'Constraint Gates', value: '9' },
        { label: 'Score Threshold', value: '80%' },
      ].map(({ label, value }) => (
        <div key={label} className="bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Collapsible section wrapper ───────────────────────────────────────────

function Section({ title, defaultOpen = false, children }: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-gray-200 pt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-purple-700 transition-colors w-full text-left"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────

export function MatchingEngineOverview() {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-purple-900">Matching Engine Overview</CardTitle>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-purple-100 text-purple-600 rounded">
              Docs
            </span>
          </div>
          {expanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
        </div>
        {!expanded && (
          <p className="text-xs text-gray-500 mt-1">
            Pipeline, weights, gates, and engine metadata — click to expand
          </p>
        )}
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-600 pb-2">
            The HAEVN matching engine uses a <span className="font-semibold">Gate &amp; Weight model</span>. Potential matches must first pass structural and dealbreaker gates before compatibility scoring occurs.
          </p>
          <Section title="Matching Pipeline" defaultOpen>
            <EnginePipeline />
          </Section>

          <Section title="Compatibility Macro Weights (Spec Model)" defaultOpen>
            <MacroWeightBars />
          </Section>

          <Section title="Constraint Gates (9)" defaultOpen>
            <GateReference />
          </Section>

          <Section title="Engine Metadata" defaultOpen>
            <EngineMetadata />
          </Section>
        </CardContent>
      )}
    </Card>
  )
}
