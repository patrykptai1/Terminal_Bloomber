'use client'

import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface PlanStep {
  step_id: number
  sub_goal: string
  tool: string
  reason?: string
}

interface TrajectoryItem {
  type: string
  step_id?: number
  tool?: string
  error?: string
}

interface Props {
  plan: { objective?: string; steps?: PlanStep[] } | null
  trajectory: TrajectoryItem[]
  loading: boolean
}

export default function PlanStepsDisplay({ plan, trajectory, loading }: Props) {
  if (!plan?.steps?.length) return null

  const completedSteps = new Set(
    trajectory
      .filter(t => t.type === 'tool_call' && t.step_id != null)
      .map(t => t.step_id)
  )

  const errorSteps = new Set(
    trajectory
      .filter(t => t.type === 'error' && t.step_id != null)
      .map(t => t.step_id)
  )

  const allDone = plan.steps.every(
    s => completedSteps.has(s.step_id) || errorSteps.has(s.step_id)
  )

  // Find current step (first not completed/errored)
  const currentStepId = loading && !allDone
    ? plan.steps.find(s => !completedSteps.has(s.step_id) && !errorSteps.has(s.step_id))?.step_id
    : null

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-xs space-y-2">
      {plan.objective && (
        <div className="text-gray-400 font-medium text-[11px] mb-1">
          🎯 {plan.objective}
        </div>
      )}
      <div className="space-y-1.5">
        {plan.steps.map(step => {
          const done = completedSteps.has(step.step_id)
          const errored = errorSteps.has(step.step_id)
          const active = currentStepId === step.step_id

          return (
            <div
              key={step.step_id}
              className={`flex items-start gap-2 ${
                done ? 'text-green-400' : errored ? 'text-red-400' : active ? 'text-orange-400' : 'text-gray-500'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {done ? (
                  <CheckCircle2 size={14} />
                ) : active ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : errored ? (
                  <span className="text-red-400">✗</span>
                ) : (
                  <Circle size={14} />
                )}
              </div>
              <div>
                <span className="font-medium">{step.sub_goal}</span>
                <span className="text-gray-600 ml-1.5">({step.tool})</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
