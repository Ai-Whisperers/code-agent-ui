import { useState } from 'react'
import { MessageCircleQuestion, CheckCircle2 } from 'lucide-react'
import type { ClarificationQuestion } from '@/types/api'

interface ClarificationBlockProps {
  questions: ClarificationQuestion[]
  /** Called with a formatted markdown string of answers when the user submits. */
  onSubmit?: (formattedAnswers: string) => void
  /** When true, renders a read-only summary of the submitted answers. */
  answered?: boolean
}

export function ClarificationBlock({ questions, onSubmit, answered = false }: ClarificationBlockProps) {
  const [textValues, setTextValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, '']))
  )
  const [singleChoiceValues, setSingleChoiceValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.filter((q) => q.type === 'single_choice').map((q) => [q.id, '']))
  )
  const [multiChoiceValues, setMultiChoiceValues] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(questions.filter((q) => q.type === 'multiple_choice').map((q) => [q.id, []]))
  )
  const [booleanValues, setBooleanValues] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(questions.filter((q) => q.type === 'boolean').map((q) => [q.id, null]))
  )
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string>>({})

  const getAnswerForQuestion = (q: ClarificationQuestion): string => {
    switch (q.type) {
      case 'text':
        return textValues[q.id] ?? ''
      case 'single_choice':
        return singleChoiceValues[q.id] ?? ''
      case 'multiple_choice':
        return (multiChoiceValues[q.id] ?? []).join(', ')
      case 'boolean': {
        const val = booleanValues[q.id]
        return val === null ? '' : val ? 'Yes' : 'No'
      }
    }
  }

  const isComplete = questions.every((q) => {
    const answer = getAnswerForQuestion(q)
    return answer.trim().length > 0
  })

  const handleSubmit = () => {
    if (!isComplete || !onSubmit) return

    const answers: Record<string, string> = {}
    const lines = questions.map((q) => {
      const answer = getAnswerForQuestion(q)
      answers[q.id] = answer
      return `**${q.question}** ${answer}`
    })

    setSubmittedAnswers(answers)
    onSubmit(lines.join('\n'))
  }

  const toggleMultiChoice = (questionId: string, option: string) => {
    setMultiChoiceValues((prev) => {
      const current = prev[questionId] ?? []
      return {
        ...prev,
        [questionId]: current.includes(option)
          ? current.filter((v) => v !== option)
          : [...current, option],
      }
    })
  }

  // Read-only summary shown after submission
  if (answered) {
    return (
      <div className="mt-3 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)] px-4 py-3">
        <div className="flex items-center gap-2 mb-2.5">
          <CheckCircle2 size={14} className="text-green-500 shrink-0" />
          <span className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
            Answers submitted
          </span>
        </div>
        <div className="space-y-1.5">
          {questions.map((q) => (
            <div key={q.id} className="text-sm">
              <span className="text-[var(--color-fonts-font-color-support)]">{q.question}</span>
              {' '}
              <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
                {submittedAnswers[q.id] ?? getAnswerForQuestion(q) ?? '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)] px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircleQuestion size={14} className="text-[var(--color-buttons-button-primary)] shrink-0" />
        <span className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
          A few quick questions
        </span>
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)] mb-2">
              {q.question}
            </p>

            {q.type === 'text' && (
              <input
                type="text"
                value={textValues[q.id] ?? ''}
                onChange={(e) =>
                  setTextValues((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isComplete) handleSubmit()
                }}
                placeholder="Type your answer…"
                className="w-full rounded-[var(--border-radius-button-small)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-inputs-input-background)] px-3 py-2 text-sm text-[var(--color-fonts-font-color-primary)] placeholder-[var(--color-fonts-font-color-support)] outline-none focus:border-[var(--color-buttons-button-primary)] transition-colors"
              />
            )}

            {q.type === 'single_choice' && q.options && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((option) => {
                  const selected = singleChoiceValues[q.id] === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setSingleChoiceValues((prev) => ({ ...prev, [q.id]: option }))
                      }
                      className={[
                        'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                        selected
                          ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-buttons-button-primary)] text-white'
                          : 'border-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-primary)] hover:border-[var(--color-buttons-button-primary)] hover:text-[var(--color-buttons-button-primary)]',
                      ].join(' ')}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            )}

            {q.type === 'multiple_choice' && q.options && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((option) => {
                  const selected = (multiChoiceValues[q.id] ?? []).includes(option)
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleMultiChoice(q.id, option)}
                      className={[
                        'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                        selected
                          ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-buttons-button-primary)] text-white'
                          : 'border-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-primary)] hover:border-[var(--color-buttons-button-primary)] hover:text-[var(--color-buttons-button-primary)]',
                      ].join(' ')}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            )}

            {q.type === 'boolean' && (
              <div className="flex gap-2">
                {(['Yes', 'No'] as const).map((label) => {
                  const boolVal = label === 'Yes'
                  const selected = booleanValues[q.id] === boolVal
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setBooleanValues((prev) => ({ ...prev, [q.id]: boolVal }))
                      }
                      className={[
                        'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                        selected
                          ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-buttons-button-primary)] text-white'
                          : 'border-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-primary)] hover:border-[var(--color-buttons-button-primary)] hover:text-[var(--color-buttons-button-primary)]',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isComplete || !onSubmit}
          className={[
            'px-4 py-2 rounded-[var(--border-radius-button-small)] text-sm font-medium transition-colors',
            isComplete && onSubmit
              ? 'bg-[var(--color-buttons-button-primary)] text-white hover:opacity-90'
              : 'bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] cursor-not-allowed border border-[var(--color-cards-card-stroke)]',
          ].join(' ')}
        >
          Submit answers
        </button>
      </div>
    </div>
  )
}
