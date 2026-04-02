import { useState } from 'react'
import { Wrench } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import api from '@/lib/api'
import type { SecurityIssueRow } from '@/types/api'

interface CreateFixButtonProps {
  issue: SecurityIssueRow
}

export function CreateFixButton({ issue }: CreateFixButtonProps) {
  const queryClient = useQueryClient()
  const [done, setDone] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/aikido-fix', {
        aikidoGroupId: issue.issueGroupId,
        repoUrl: issue.repoUrl ?? null,
        ruleNames: issue.issueType ? [issue.issueType] : [],
      }),
    onSuccess: () => {
      setDone(true)
      queryClient.invalidateQueries({ queryKey: ['security-issues'] })
    },
  })

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
        Job created
      </span>
    )
  }

  return (
    <Tooltip text="Create a fix job for this vulnerability">
      <Button
        variant="ghost"
        size="sm"
        icon={<Wrench size={12} />}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Creating…' : 'Fix'}
      </Button>
    </Tooltip>
  )
}
