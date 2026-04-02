import { useState } from 'react'
import { Wrench } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import api from '@/lib/api'
import type { SecurityIssueRow } from '@/types/api'

interface CreateFixAllButtonProps {
  issues: SecurityIssueRow[]
}

export function CreateFixAllButton({ issues }: CreateFixAllButtonProps) {
  const queryClient = useQueryClient()
  const [doneCount, setDoneCount] = useState(0)

  // Only issues that don't already have a linked job
  const fixable = issues.filter((i) => !i.linkedJobId)

  const mutation = useMutation({
    mutationFn: async () => {
      let count = 0
      for (const issue of fixable) {
        await api.post('/aikido-fix', {
          aikidoGroupId: issue.issueGroupId,
          repoUrl: issue.repoUrl ?? null,
          ruleNames: issue.issueType ? [issue.issueType] : [],
        })
        count++
        setDoneCount(count)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-issues'] })
    },
  })

  if (fixable.length === 0) return null

  if (mutation.isSuccess) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-semibold bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
        {doneCount} job{doneCount !== 1 ? 's' : ''} created
      </span>
    )
  }

  return (
    <Tooltip text={`Create fix jobs for all ${fixable.length} unfixed issue${fixable.length !== 1 ? 's' : ''}`}>
      <Button
        variant="ghost"
        size="sm"
        icon={<Wrench size={12} />}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? `Fixing ${doneCount}/${fixable.length}…` : `Fix all (${fixable.length})`}
      </Button>
    </Tooltip>
  )
}
