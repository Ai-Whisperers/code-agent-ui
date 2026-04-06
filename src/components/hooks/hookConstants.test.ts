import {
  CATEGORIES,
  TRIGGER_OPTIONS,
  CATEGORY_COLORS,
  ACTION_TYPES,
  PROMPT_TEMPLATES,
  getCategory,
  getCategories,
  getTriggerLabel,
  generatePromptTemplate,
  subTriggerLabel,
} from './hookConstants'
import type { AutomationHook } from '@/types/api'

describe('hookConstants', () => {
  describe('constants', () => {
    it('should export correct trigger categories', () => {
      expect(CATEGORIES).toEqual([
        'ALL', 'SCM', 'Jira', 'Confluence', 'Aikido', 'Cron', 'Teams', 'Quality', 'Other'
      ])
    })

    it('should have valid trigger options structure', () => {
      expect(TRIGGER_OPTIONS).toBeInstanceOf(Array)
      expect(TRIGGER_OPTIONS.length).toBeGreaterThan(0)

      TRIGGER_OPTIONS.forEach(category => {
        expect(category).toHaveProperty('category')
        expect(category).toHaveProperty('triggers')
        expect(category.triggers).toBeInstanceOf(Array)

        category.triggers.forEach(trigger => {
          expect(trigger).toHaveProperty('value')
          expect(trigger).toHaveProperty('label')
          expect(trigger).toHaveProperty('description')
          expect(typeof trigger.value).toBe('string')
          expect(typeof trigger.label).toBe('string')
          expect(typeof trigger.description).toBe('string')
        })
      })
    })

    it('should have category colors for all non-ALL categories', () => {
      const nonAllCategories = CATEGORIES.filter(cat => cat !== 'ALL')
      nonAllCategories.forEach(category => {
        expect(CATEGORY_COLORS).toHaveProperty(category)
        expect(typeof CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]).toBe('string')
      })
    })

    it('should have valid action types structure', () => {
      expect(ACTION_TYPES).toBeInstanceOf(Array)
      expect(ACTION_TYPES.length).toBeGreaterThan(0)

      ACTION_TYPES.forEach(action => {
        expect(action).toHaveProperty('id')
        expect(action).toHaveProperty('label')
        expect(action).toHaveProperty('description')
        expect(action).toHaveProperty('icon')
        expect(typeof action.id).toBe('string')
        expect(typeof action.label).toBe('string')
        expect(typeof action.description).toBe('string')
        // Icon can be either a function (component) or object in test env
        expect(['function', 'object']).toContain(typeof action.icon)
      })
    })

    it('should have prompt templates for all major trigger types', () => {
      expect(PROMPT_TEMPLATES).toHaveProperty('base')
      expect(PROMPT_TEMPLATES).toHaveProperty('scm')
      expect(PROMPT_TEMPLATES).toHaveProperty('jira')
      expect(PROMPT_TEMPLATES).toHaveProperty('confluence')
      expect(PROMPT_TEMPLATES).toHaveProperty('aikido')
      expect(PROMPT_TEMPLATES).toHaveProperty('cron')
      expect(PROMPT_TEMPLATES).toHaveProperty('teams')
      expect(PROMPT_TEMPLATES).toHaveProperty('quality')

      Object.values(PROMPT_TEMPLATES).forEach(template => {
        expect(typeof template).toBe('string')
        expect(template.length).toBeGreaterThan(0)
      })
    })
  })

  describe('getCategory', () => {
    it('should return correct category for SCM triggers', () => {
      expect(getCategory('scm.pr_created')).toBe('SCM')
      expect(getCategory('scm.pr_updated')).toBe('SCM')
      expect(getCategory('scm.pr_merged')).toBe('SCM')
      expect(getCategory('pr_event')).toBe('SCM')
    })

    it('should return correct category for Jira triggers', () => {
      expect(getCategory('jira.issue_created')).toBe('Jira')
      expect(getCategory('jira.issue_updated')).toBe('Jira')
      expect(getCategory('jira.issue_assigned')).toBe('Jira')
    })

    it('should return correct category for Confluence triggers', () => {
      expect(getCategory('confluence.page_created')).toBe('Confluence')
      expect(getCategory('confluence.page_updated')).toBe('Confluence')
    })

    it('should return correct category for Aikido triggers', () => {
      expect(getCategory('aikido.vulnerability_new')).toBe('Aikido')
      expect(getCategory('aikido.vulnerability_fixed')).toBe('Aikido')
    })

    it('should return correct category for Cron triggers', () => {
      expect(getCategory('cron')).toBe('Cron')
    })

    it('should return correct category for Teams triggers', () => {
      expect(getCategory('teams.message')).toBe('Teams')
      expect(getCategory('teams.notification')).toBe('Teams')
    })

    it('should return correct category for Quality triggers', () => {
      expect(getCategory('quality.report_generated')).toBe('Quality')
      expect(getCategory('quality.threshold_exceeded')).toBe('Quality')
    })

    it('should return Other for unknown triggers', () => {
      expect(getCategory('unknown.trigger')).toBe('Other')
      expect(getCategory('random')).toBe('Other')
      expect(getCategory('custom_event')).toBe('Other')
    })

    it('should return Other for undefined/null/empty triggers', () => {
      expect(getCategory(undefined)).toBe('Other')
      expect(getCategory('')).toBe('Other')
    })

    it('should be case sensitive', () => {
      expect(getCategory('SCM.pr_created')).toBe('Other')
      expect(getCategory('JIRA.issue_created')).toBe('Other')
    })
  })

  describe('getCategories', () => {
    it('should return array of categories for multiple trigger types', () => {
      const triggers = ['scm.pr_created', 'jira.issue_updated', 'cron']
      const result = getCategories(triggers)
      expect(result).toEqual(['SCM', 'Jira', 'Cron'])
    })

    it('should deduplicate categories', () => {
      const triggers = ['scm.pr_created', 'scm.pr_updated', 'scm.pr_merged']
      const result = getCategories(triggers)
      expect(result).toEqual(['SCM'])
    })

    it('should handle mixed known and unknown triggers', () => {
      const triggers = ['scm.pr_created', 'unknown.trigger', 'jira.issue_updated']
      const result = getCategories(triggers)
      expect(result).toEqual(['SCM', 'Other', 'Jira'])
    })

    it('should return Other for empty array', () => {
      expect(getCategories([])).toEqual(['Other'])
    })

    it('should return Other for undefined/null', () => {
      expect(getCategories(undefined)).toEqual(['Other'])
      expect(getCategories(null as any)).toEqual(['Other'])
    })

    it('should preserve order of first occurrence', () => {
      const triggers = ['jira.issue_created', 'scm.pr_created', 'unknown.trigger']
      const result = getCategories(triggers)
      expect(result).toEqual(['Jira', 'SCM', 'Other'])
    })

    it('should handle all category types', () => {
      const triggers = [
        'scm.pr_created',
        'jira.issue_updated', 
        'confluence.page_created',
        'aikido.vulnerability_new',
        'cron',
        'teams.message',
        'quality.report_generated',
        'unknown.trigger'
      ]
      const result = getCategories(triggers)
      expect(result).toEqual(['SCM', 'Jira', 'Confluence', 'Aikido', 'Cron', 'Teams', 'Quality', 'Other'])
    })
  })

  describe('getTriggerLabel', () => {
    it('should return correct labels for SCM triggers', () => {
      expect(getTriggerLabel('scm.pr_created')).toBe('PR Created')
      expect(getTriggerLabel('scm.pr_updated')).toBe('PR Updated')
      expect(getTriggerLabel('scm.pr_merged')).toBe('PR Merged')
      expect(getTriggerLabel('pr_event')).toBe('PR Event (Legacy)')
    })

    it('should return correct labels for Jira triggers', () => {
      expect(getTriggerLabel('jira.issue_created')).toBe('Issue Created')
      expect(getTriggerLabel('jira.issue_updated')).toBe('Issue Updated')
      expect(getTriggerLabel('jira.issue_assigned')).toBe('Issue Assigned')
    })

    it('should return correct labels for Confluence triggers', () => {
      expect(getTriggerLabel('confluence.page_created')).toBe('Page Created')
      expect(getTriggerLabel('confluence.page_updated')).toBe('Page Updated')
    })

    it('should return correct labels for Aikido triggers', () => {
      expect(getTriggerLabel('aikido.vulnerability_new')).toBe('New Vulnerability')
      expect(getTriggerLabel('aikido.vulnerability_fixed')).toBe('Vulnerability Fixed')
    })

    it('should return correct labels for Schedule triggers', () => {
      expect(getTriggerLabel('cron')).toBe('Cron Schedule')
    })

    it('should return correct labels for Teams triggers', () => {
      expect(getTriggerLabel('teams.message')).toBe('Teams Message')
    })

    it('should return correct labels for Quality triggers', () => {
      expect(getTriggerLabel('quality.report_generated')).toBe('Report Generated')
    })

    it('should return the value itself for unknown triggers', () => {
      expect(getTriggerLabel('unknown.trigger')).toBe('unknown.trigger')
      expect(getTriggerLabel('custom_event')).toBe('custom_event')
      expect(getTriggerLabel('')).toBe('')
    })

    it('should be case sensitive', () => {
      expect(getTriggerLabel('SCM.pr_created')).toBe('SCM.pr_created')
      expect(getTriggerLabel('jira.ISSUE_CREATED')).toBe('jira.ISSUE_CREATED')
    })
  })

  describe('generatePromptTemplate', () => {
    it('should include base template in all outputs', () => {
      const result = generatePromptTemplate('scm.pr_created')
      expect(result).toContain(PROMPT_TEMPLATES.base)
    })

    it('should append SCM-specific template for SCM triggers', () => {
      const result = generatePromptTemplate('scm.pr_created')
      expect(result).toBe(PROMPT_TEMPLATES.base + PROMPT_TEMPLATES.scm)
    })

    it('should append Jira-specific template for Jira triggers', () => {
      const result = generatePromptTemplate('jira.issue_updated')
      expect(result).toBe(PROMPT_TEMPLATES.base + PROMPT_TEMPLATES.jira)
    })

    it('should append Confluence-specific template for Confluence triggers', () => {
      const result = generatePromptTemplate('confluence.page_created')
      expect(result).toBe(PROMPT_TEMPLATES.base + PROMPT_TEMPLATES.confluence)
    })

    it('should append Aikido-specific template for Aikido triggers', () => {
      const result = generatePromptTemplate('aikido.vulnerability_new')
      expect(result).toBe(PROMPT_TEMPLATES.base + PROMPT_TEMPLATES.aikido)
    })

    it('should append Cron-specific template for cron trigger', () => {
      const result = generatePromptTemplate('cron')
      expect(result).toBe(PROMPT_TEMPLATES.base + PROMPT_TEMPLATES.cron)
    })

    it('should append Teams-specific template for Teams triggers', () => {
      const result = generatePromptTemplate('teams.message')
      expect(result).toBe(PROMPT_TEMPLATES.base + PROMPT_TEMPLATES.teams)
    })

    it('should append Quality-specific template for Quality triggers', () => {
      const result = generatePromptTemplate('quality.report_generated')
      expect(result).toBe(PROMPT_TEMPLATES.base + PROMPT_TEMPLATES.quality)
    })

    it('should use default template for unknown triggers', () => {
      const result = generatePromptTemplate('unknown.trigger')
      expect(result).toBe(PROMPT_TEMPLATES.base + 'Analyze the trigger context and determine the appropriate action to take.')
    })

    it('should use default template for undefined trigger', () => {
      const result = generatePromptTemplate(undefined)
      expect(result).toBe(PROMPT_TEMPLATES.base + 'Analyze the trigger context and determine the appropriate action to take.')
    })

    it('should use default template for empty trigger', () => {
      const result = generatePromptTemplate('')
      expect(result).toBe(PROMPT_TEMPLATES.base + 'Analyze the trigger context and determine the appropriate action to take.')
    })

    it('should be case sensitive for trigger matching', () => {
      const result = generatePromptTemplate('SCM.pr_created')
      expect(result).toBe(PROMPT_TEMPLATES.base + 'Analyze the trigger context and determine the appropriate action to take.')
    })
  })

  describe('subTriggerLabel', () => {
    const createHook = (overrides: Partial<AutomationHook> = {}): AutomationHook => ({
      name: 'test-hook',
      enabled: true,
      ...overrides,
    })

    it('should return cron expression when present', () => {
      const hook = createHook({ cronExpr: '0 9 * * 1' })
      expect(subTriggerLabel(hook)).toBe('⏱ 0 9 * * 1')
    })

    it('should return PR event when present', () => {
      const hook = createHook({ prEvent: 'opened' })
      expect(subTriggerLabel(hook)).toBe('opened')
    })

    it('should return PR event with branch pattern', () => {
      const hook = createHook({ 
        prEvent: 'opened', 
        branchPattern: 'feature/*' 
      })
      expect(subTriggerLabel(hook)).toBe('opened · feature/*')
    })

    it('should return trigger types excluding pr_event', () => {
      const hook = createHook({ 
        triggerTypes: ['jira.issue_created', 'scm.pr_updated'] 
      })
      expect(subTriggerLabel(hook)).toBe('jira.issue_created, scm.pr_updated')
    })

    it('should filter out pr_event from trigger types', () => {
      const hook = createHook({ 
        triggerTypes: ['pr_event', 'jira.issue_created', 'scm.pr_updated'] 
      })
      expect(subTriggerLabel(hook)).toBe('jira.issue_created, scm.pr_updated')
    })

    it('should return null when only pr_event in trigger types', () => {
      const hook = createHook({ 
        triggerTypes: ['pr_event'] 
      })
      expect(subTriggerLabel(hook)).toBeNull()
    })

    it('should return null when no relevant trigger info present', () => {
      const hook = createHook({})
      expect(subTriggerLabel(hook)).toBeNull()
    })

    it('should return null when trigger types is empty', () => {
      const hook = createHook({ triggerTypes: [] })
      expect(subTriggerLabel(hook)).toBeNull()
    })

    it('should prioritize cron over PR event', () => {
      const hook = createHook({ 
        cronExpr: '0 9 * * 1',
        prEvent: 'opened' 
      })
      expect(subTriggerLabel(hook)).toBe('⏱ 0 9 * * 1')
    })

    it('should prioritize PR event over trigger types', () => {
      const hook = createHook({ 
        prEvent: 'closed',
        triggerTypes: ['jira.issue_created'] 
      })
      expect(subTriggerLabel(hook)).toBe('closed')
    })

    it('should handle complex branch patterns', () => {
      const hook = createHook({ 
        prEvent: 'synchronize',
        branchPattern: 'feature/JIRA-*' 
      })
      expect(subTriggerLabel(hook)).toBe('synchronize · feature/JIRA-*')
    })

    it('should handle multiple trigger types', () => {
      const hook = createHook({ 
        triggerTypes: [
          'jira.issue_created',
          'confluence.page_updated', 
          'aikido.vulnerability_new'
        ] 
      })
      expect(subTriggerLabel(hook)).toBe('jira.issue_created, confluence.page_updated, aikido.vulnerability_new')
    })

    it('should handle empty branch pattern', () => {
      const hook = createHook({ 
        prEvent: 'opened',
        branchPattern: '' 
      })
      expect(subTriggerLabel(hook)).toBe('opened')
    })

    it('should handle whitespace in cron expression', () => {
      const hook = createHook({ cronExpr: '  0 9 * * 1  ' })
      expect(subTriggerLabel(hook)).toBe('⏱   0 9 * * 1  ')
    })
  })

  describe('integration tests', () => {
    it('should have consistent category mappings across functions', () => {
      const triggers = ['scm.pr_created', 'jira.issue_updated', 'confluence.page_created']
      
      const categories = getCategories(triggers)
      expect(categories).toEqual(['SCM', 'Jira', 'Confluence'])
      
      triggers.forEach(trigger => {
        const category = getCategory(trigger)
        expect(categories).toContain(category)
      })
    })

    it('should have labels for all trigger options', () => {
      TRIGGER_OPTIONS.forEach(categoryGroup => {
        categoryGroup.triggers.forEach(trigger => {
          const label = getTriggerLabel(trigger.value)
          expect(label).toBe(trigger.label)
        })
      })
    })

    it('should generate appropriate templates for each trigger category', () => {
      const testTriggers = [
        'scm.pr_created',
        'jira.issue_updated',
        'confluence.page_created',
        'aikido.vulnerability_new',
        'cron',
        'teams.message',
        'quality.report_generated'
      ]

      testTriggers.forEach(trigger => {
        const template = generatePromptTemplate(trigger)
        expect(template).toContain(PROMPT_TEMPLATES.base)
        expect(template.length).toBeGreaterThan(PROMPT_TEMPLATES.base.length)
      })
    })

    it('should handle automation hook with all fields populated', () => {
      const hook: AutomationHook = {
        name: 'comprehensive-hook',
        enabled: true,
        description: 'A comprehensive test hook',
        triggerTypes: ['jira.issue_created', 'scm.pr_created'],
        prEvent: 'opened',
        branchPattern: 'feature/*',
        cronExpr: '0 9 * * 1',
        actionType: 'ai_prompt',
        prompt: 'Test prompt',
        jobName: 'test-job',
        newBranchName: 'auto-fix',
        ruleNames: ['rule1', 'rule2'],
        extraRules: 'extra rules',
        targetBranch: 'main',
        commitDirect: true,
        repoUrl: 'https://github.com/test/repo',
        triggerFilter: { key: 'value' }
      }

      // Should prioritize cron expression
      expect(subTriggerLabel(hook)).toBe('⏱ 0 9 * * 1')

      // Should categorize based on trigger types
      const categories = getCategories(hook.triggerTypes)
      expect(categories).toEqual(['Jira', 'SCM'])
    })

    it('should handle edge cases consistently', () => {
      const edgeCases = [undefined, '']
      
      edgeCases.forEach(testCase => {
        expect(getCategory(testCase as any)).toBe('Other')
        expect(getTriggerLabel(testCase as any)).toBe(testCase ?? '')
        
        const template = generatePromptTemplate(testCase as any)
        expect(template).toContain('Analyze the trigger context')
      })
    })
  })
})