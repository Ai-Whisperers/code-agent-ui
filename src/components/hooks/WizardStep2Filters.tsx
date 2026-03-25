import { useState } from 'react'
import { X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { AutomationHook } from '@/types/api'
import { RepositorySelect } from '@/components/ui/RepositorySelect'

const inputCls = 'w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]'
const labelCls = 'block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide'

interface Props {
  form: AutomationHook
  setForm: Dispatch<SetStateAction<AutomationHook>>
  hasScmTriggers: boolean
  hasAikidoTriggers: boolean
  hasJiraTriggers: boolean
  hasQualityTriggers: boolean
  needsCronExpr: boolean
  needsPrEvent: boolean
}

export function WizardStep2Filters({
  form, setForm,
  hasScmTriggers, hasAikidoTriggers, hasJiraTriggers, hasQualityTriggers,
  needsCronExpr, needsPrEvent,
}: Props) {
  const [jiraProjectInput, setJiraProjectInput] = useState('')

  const jiraProjectKeys: string[] = form.triggerFilter?.projectKeys
    ? form.triggerFilter.projectKeys.split(',').map(s => s.trim()).filter(Boolean)
    : []

  function addJiraProjectKey(raw: string) {
    const key = raw.trim().toUpperCase()
    if (!key || jiraProjectKeys.includes(key)) { setJiraProjectInput(''); return }
    setForm(p => {
      const f = { ...(p.triggerFilter || {}) }
      f.projectKeys = [...jiraProjectKeys, key].join(',')
      return { ...p, triggerFilter: f }
    })
    setJiraProjectInput('')
  }

  function removeJiraProjectKey(key: string) {
    setForm(p => {
      const f = { ...(p.triggerFilter || {}) }
      const next = jiraProjectKeys.filter(k => k !== key)
      if (next.length > 0) f.projectKeys = next.join(',')
      else delete f.projectKeys
      return { ...p, triggerFilter: f }
    })
  }

  function setFilterField(field: string, value: string) {
    setForm(p => {
      const f = { ...(p.triggerFilter || {}) }
      if (value) f[field] = value
      else delete f[field]
      return { ...p, triggerFilter: f }
    })
  }

  return (
    <div className="space-y-5">

      {/* Repository multi-select — always shown */}
      <div>
        <label className={labelCls}>Restrict to Repositories</label>
        <RepositorySelect
          value={
            form.triggerFilter?.repoSlug
              ? form.triggerFilter.repoSlug.split(',').map(s => s.trim()).filter(Boolean)
              : []
          }
          onChange={repos => setFilterField('repoSlug', repos.join(','))}
        />
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1.5">
          Leave empty to trigger for all repositories.
        </p>
      </div>

      {/* Branch Pattern — SCM only */}
      {hasScmTriggers && (
        <div>
          <label className={labelCls}>
            Branch Pattern
            <span className="ml-1 font-normal normal-case text-[var(--color-fonts-font-color-support)]">(optional)</span>
          </label>
          <input
            type="text"
            value={form.branchPattern ?? ''}
            onChange={e => setForm(p => ({ ...p, branchPattern: e.target.value }))}
            placeholder="^(main|develop)$"
            className={inputCls + ' font-mono'}
          />
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1.5 leading-relaxed">
            Regex applied to the source branch name — e.g.{' '}
            <code className="px-1 py-0.5 rounded bg-[var(--color-inputs-input-background)] font-mono text-[0.7rem]">^(main|develop)$</code>{' '}
            restricts to <em>main</em> and <em>develop</em>. Leave empty for all branches.
          </p>
        </div>
      )}

      {/* PR Event (legacy) */}
      {needsPrEvent && (
        <div>
          <label className={labelCls}>PR Event</label>
          <select
            value={form.prEvent ?? ''}
            onChange={e => setForm(p => ({ ...p, prEvent: e.target.value }))}
            className={inputCls}
          >
            <option value="">Select PR event…</option>
            <option value="pullrequest:created">PR Created</option>
            <option value="pullrequest:updated">PR Updated</option>
            <option value="pullrequest:fulfilled">PR Merged</option>
          </select>
        </div>
      )}

      {/* Cron expression */}
      {needsCronExpr && (
        <div>
          <label className={labelCls}>
            Cron Expression <span className="text-red-500 font-normal">*</span>
          </label>
          <input
            type="text"
            value={form.cronExpr ?? ''}
            onChange={e => setForm(p => ({ ...p, cronExpr: e.target.value }))}
            placeholder="0 8 * * *"
            className={inputCls + ' font-mono'}
          />
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1.5">
            Format: <code className="font-mono">minute hour dayOfMonth month dayOfWeek</code> —{' '}
            e.g. <code className="font-mono">0 8 * * *</code> for daily at 08:00.
          </p>
        </div>
      )}

      {/* Jira-specific filters */}
      {hasJiraTriggers && (
        <div className="space-y-4">
          {/* Project Keys tag input */}
          <div>
            <label className={labelCls}>Project Keys</label>
            <div
              className="flex flex-wrap gap-1.5 min-h-[38px] px-2.5 py-1.5 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] cursor-text"
              onClick={() => document.getElementById('jira-project-input')?.focus()}
            >
              {jiraProjectKeys.map(key => (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-medium">
                  {key}
                  <button type="button" onClick={() => removeJiraProjectKey(key)} className="hover:text-indigo-900 dark:hover:text-indigo-100">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                id="jira-project-input"
                type="text"
                value={jiraProjectInput}
                onChange={e => setJiraProjectInput(e.target.value.toUpperCase())}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addJiraProjectKey(jiraProjectInput) }
                  if (e.key === 'Backspace' && !jiraProjectInput && jiraProjectKeys.length > 0) {
                    removeJiraProjectKey(jiraProjectKeys[jiraProjectKeys.length - 1])
                  }
                }}
                onBlur={() => { if (jiraProjectInput) addJiraProjectKey(jiraProjectInput) }}
                placeholder={jiraProjectKeys.length === 0 ? 'Type a key and press Enter…' : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none"
              />
            </div>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1.5">
              Leave empty to match all projects.
            </p>
          </div>

          {/* Transition filter */}
          <div>
            <label className={labelCls}>
              Transition
              <span className="ml-1 font-normal normal-case text-[var(--color-fonts-font-color-support)]">(optional)</span>
            </label>
            <input
              type="text"
              value={form.triggerFilter?.transition ?? ''}
              onChange={e => setFilterField('transition', e.target.value)}
              placeholder="e.g. NEW, OPEN, IN_PROGRESS, DONE"
              className={inputCls}
            />
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1.5">
              Only fire when the issue transitions to this status.
            </p>
          </div>
        </div>
      )}

      {/* Quality report filters */}
      {hasQualityTriggers && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-[var(--color-cards-card-stroke)]" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-1">
              Quality Thresholds
            </span>
            <div className="flex-1 h-px bg-[var(--color-cards-card-stroke)]" />
          </div>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] -mt-1">
            Trigger only when the report falls below these thresholds. Leave blank to trigger for every report.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Score below <span className="font-normal normal-case text-[var(--color-fonts-font-color-support)]">(0 – 100)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.triggerFilter?.minScore ?? ''}
                  onChange={e => setFilterField('minScore', e.target.value)}
                  placeholder="e.g. 80"
                  className={inputCls + ' pr-8'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-fonts-font-color-support)] pointer-events-none">
                  pts
                </span>
              </div>
            </div>
            <div>
              <label className={labelCls}>
                Coverage below <span className="font-normal normal-case text-[var(--color-fonts-font-color-support)]">(0 – 100)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.triggerFilter?.minCoverage ?? ''}
                  onChange={e => setFilterField('minCoverage', e.target.value)}
                  placeholder="e.g. 70"
                  className={inputCls + ' pr-6'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-fonts-font-color-support)] pointer-events-none">
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aikido filters */}
      {hasAikidoTriggers && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Severity</label>
            <select
              value={form.triggerFilter?.severity ?? ''}
              onChange={e => setFilterField('severity', e.target.value)}
              className={inputCls}
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Issue Type</label>
            <select
              value={form.triggerFilter?.issueType ?? ''}
              onChange={e => setFilterField('issueType', e.target.value)}
              className={inputCls}
            >
              <option value="">All issue types</option>
              <option value="sca">Open-source Dependencies</option>
              <option value="sast">SAST</option>
              <option value="iac">Infrastructure As Code</option>
              <option value="secrets">Exposed Secrets</option>
              <option value="dast">DAST / Surface Monitoring</option>
              <option value="ai_pentest">AI Pentest Issues</option>
              <option value="cloud">Cloud Configurations</option>
              <option value="kubernetes">Kubernetes Configurations</option>
              <option value="container">Container Images</option>
              <option value="vm">Virtual Machines</option>
              <option value="mobile">Mobile Issues</option>
              <option value="malware">Malware Issues</option>
              <option value="eol">End-of-life Runtimes</option>
              <option value="license">License Issues</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
