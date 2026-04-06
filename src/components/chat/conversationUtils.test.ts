import { 
  saveMessagesToStorage, 
  loadMessagesFromStorage, 
  groupConversations, 
  CONV_LS_KEY,
} from './conversationUtils'
import type { ChatMessage, ConversationSummary } from '@/types/api'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

describe('conversationUtils', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    store = {}
    localStorageMock.clear()
    localStorageMock.getItem.mockImplementation((key: string) => store[key] || null)
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      store[key] = value
    })
    localStorageMock.removeItem.mockImplementation((key: string) => {
      delete store[key]
    })
    vi.clearAllMocks()
  })

  describe('CONV_LS_KEY', () => {
    it('should generate correct localStorage key', () => {
      expect(CONV_LS_KEY('123')).toBe('conv_messages_123')
      expect(CONV_LS_KEY('abc-def')).toBe('conv_messages_abc-def')
      expect(CONV_LS_KEY('')).toBe('conv_messages_')
    })

    it('should handle special characters in id', () => {
      expect(CONV_LS_KEY('test@123')).toBe('conv_messages_test@123')
      expect(CONV_LS_KEY('user-123_conv')).toBe('conv_messages_user-123_conv')
    })
  })

  describe('saveMessagesToStorage', () => {
    it('should save messages to localStorage', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi there!' }
      ]
      
      saveMessagesToStorage('test-conv', messages)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'conv_messages_test-conv',
        JSON.stringify(messages)
      )
      expect(store['conv_messages_test-conv']).toBe(JSON.stringify(messages))
    })

    it('should save empty array', () => {
      saveMessagesToStorage('empty-conv', [])
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'conv_messages_empty-conv',
        '[]'
      )
    })

    it('should handle messages with complex content', () => {
      const messages: ChatMessage[] = [
        { 
          id: '1',
          role: 'user', 
          content: 'Complex message with\nnewlines and "quotes"' 
        },
        { 
          id: '2',
          role: 'assistant', 
          content: '```javascript\nconsole.log("code block");\n```',
          thinkingSteps: [
            { kind: 'thought', text: 'thinking...' }
          ]
        }
      ]
      
      saveMessagesToStorage('complex-conv', messages)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'conv_messages_complex-conv',
        JSON.stringify(messages)
      )
    })

    it('should silently handle localStorage quota exceeded error', () => {
      const messages: ChatMessage[] = [{ id: '1', role: 'user', content: 'test' }]
      
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      
      expect(() => saveMessagesToStorage('test', messages)).not.toThrow()
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('should silently handle other localStorage errors', () => {
      const messages: ChatMessage[] = [{ id: '1', role: 'user', content: 'test' }]
      
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Some other error')
      })
      
      expect(() => saveMessagesToStorage('test', messages)).not.toThrow()
    })

    it('should handle different conversation IDs', () => {
      const messages1: ChatMessage[] = [{ id: '1', role: 'user', content: 'Conv 1' }]
      const messages2: ChatMessage[] = [{ id: '2', role: 'user', content: 'Conv 2' }]
      
      saveMessagesToStorage('conv-1', messages1)
      saveMessagesToStorage('conv-2', messages2)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'conv_messages_conv-1',
        JSON.stringify(messages1)
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'conv_messages_conv-2',
        JSON.stringify(messages2)
      )
    })
  })

  describe('loadMessagesFromStorage', () => {
    it('should load messages from localStorage', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi there!' }
      ]
      
      store['conv_messages_test-conv'] = JSON.stringify(messages)
      
      const result = loadMessagesFromStorage('test-conv')
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('conv_messages_test-conv')
      expect(result).toEqual(messages)
    })

    it('should return empty array when no data exists', () => {
      const result = loadMessagesFromStorage('nonexistent-conv')
      expect(result).toEqual([])
    })

    it('should return empty array when localStorage returns empty string', () => {
      store['conv_messages_empty-conv'] = ''
      
      const result = loadMessagesFromStorage('empty-conv')
      expect(result).toEqual([])
    })

    it('should handle malformed JSON gracefully', () => {
      store['conv_messages_broken-conv'] = 'invalid json{'
      
      const result = loadMessagesFromStorage('broken-conv')
      expect(result).toEqual([])
    })

    it('should handle localStorage access errors', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Access denied')
      })
      
      const result = loadMessagesFromStorage('error-conv')
      expect(result).toEqual([])
    })

    it('should load complex messages with all properties', () => {
      const messages: ChatMessage[] = [
        { 
          id: '1',
          role: 'assistant', 
          content: 'Complex response',
          thinkingSteps: [
            { kind: 'thought', text: 'analyzing...' },
            { kind: 'thought', text: 'planning response...' }
          ]
        }
      ]
      
      store['conv_messages_complex-conv'] = JSON.stringify(messages)
      
      const result = loadMessagesFromStorage('complex-conv')
      
      expect(result).toEqual(messages)
      expect(result[0].thinkingSteps).toHaveLength(2)
    })

    it('should handle different conversation IDs', () => {
      store['conv_messages_conv-1'] = JSON.stringify([{ id: '1', role: 'user', content: 'Conv 1' }])
      store['conv_messages_conv-2'] = JSON.stringify([{ id: '2', role: 'user', content: 'Conv 2' }])
      
      const result1 = loadMessagesFromStorage('conv-1')
      const result2 = loadMessagesFromStorage('conv-2')
      const result3 = loadMessagesFromStorage('conv-3')
      
      expect(result1).toEqual([{ id: '1', role: 'user', content: 'Conv 1' }])
      expect(result2).toEqual([{ id: '2', role: 'user', content: 'Conv 2' }])
      expect(result3).toEqual([])
    })
  })

  describe('groupConversations', () => {
    const now = new Date('2024-01-15T10:00:00Z')
    
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(now)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const createConversation = (
      id: string, 
      title: string, 
      updatedAt: string
    ): ConversationSummary => ({
      conversationId: id,
      title,
      updatedAt,
      createdAt: updatedAt,
      messageCount: 0,
    })

    it('should return empty array for empty input', () => {
      const result = groupConversations([])
      expect(result).toEqual([])
    })

    it('should group conversation from today', () => {
      const conversations = [
        createConversation('1', 'Today conv', '2024-01-15T09:00:00Z')
      ]
      
      const result = groupConversations(conversations)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        label: 'Today',
        items: [conversations[0]]
      })
    })

    it('should group conversation from yesterday', () => {
      const conversations = [
        createConversation('1', 'Yesterday conv', '2024-01-14T15:00:00Z')
      ]
      
      const result = groupConversations(conversations)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        label: 'Yesterday',
        items: [conversations[0]]
      })
    })

    it('should group conversations from previous 7 days', () => {
      const conversations = [
        createConversation('1', 'Last week conv', '2024-01-10T12:00:00Z'), // 5 days ago
        createConversation('2', 'Another old', '2024-01-09T08:00:00Z')     // 6 days ago
      ]
      
      const result = groupConversations(conversations)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        label: 'Previous 7 days',
        items: conversations
      })
    })

    it('should group older conversations', () => {
      const conversations = [
        createConversation('1', 'Very old conv', '2024-01-01T12:00:00Z'), // 14 days ago
        createConversation('2', 'Ancient conv', '2023-12-15T08:00:00Z')   // month ago
      ]
      
      const result = groupConversations(conversations)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        label: 'Older',
        items: conversations
      })
    })

    it('should group conversations across all categories', () => {
      const conversations = [
        createConversation('today', 'Today conv', '2024-01-15T09:00:00Z'),
        createConversation('yesterday', 'Yesterday conv', '2024-01-14T15:00:00Z'),
        createConversation('week', 'Last week conv', '2024-01-10T12:00:00Z'),
        createConversation('old', 'Old conv', '2024-01-01T12:00:00Z')
      ]
      
      const result = groupConversations(conversations)
      
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual({
        label: 'Today',
        items: [conversations[0]]
      })
      expect(result[1]).toEqual({
        label: 'Yesterday',
        items: [conversations[1]]
      })
      expect(result[2]).toEqual({
        label: 'Previous 7 days',
        items: [conversations[2]]
      })
      expect(result[3]).toEqual({
        label: 'Older',
        items: [conversations[3]]
      })
    })

    it('should handle multiple conversations in same group', () => {
      const conversations = [
        createConversation('today1', 'First today', '2024-01-15T09:00:00Z'),
        createConversation('today2', 'Second today', '2024-01-15T14:00:00Z'),
        createConversation('today3', 'Third today', '2024-01-15T08:00:00Z')
      ]
      
      const result = groupConversations(conversations)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        label: 'Today',
        items: conversations
      })
    })

    it('should filter out empty groups', () => {
      const conversations = [
        createConversation('today', 'Today conv', '2024-01-15T09:00:00Z'),
        createConversation('old', 'Old conv', '2024-01-01T12:00:00Z')
        // No yesterday or previous 7 days conversations
      ]
      
      const result = groupConversations(conversations)
      
      expect(result).toHaveLength(2)
      expect(result.map(g => g.label)).toEqual(['Today', 'Older'])
    })

    it('should handle boundary conditions correctly', () => {
      // Test conversations right at the boundaries
      const conversations = [
        // Exactly at start of today
        createConversation('today-start', 'Today start', '2024-01-15T00:00:00Z'),
        // Exactly at start of yesterday  
        createConversation('yesterday-start', 'Yesterday start', '2024-01-14T00:00:00Z'),
        // Exactly 7 days ago from today start (should be in "Older")
        createConversation('week-boundary', 'Week boundary', '2024-01-08T00:00:00Z'),
        // Just after 7 days ago (should be in "Previous 7 days")
        createConversation('within-week', 'Within week', '2024-01-08T00:00:01Z')
      ]
      
      const result = groupConversations(conversations)
      
      const todayGroup = result.find(g => g.label === 'Today')
      const yesterdayGroup = result.find(g => g.label === 'Yesterday')
      const weekGroup = result.find(g => g.label === 'Previous 7 days')
      const olderGroup = result.find(g => g.label === 'Older')
      
      expect(todayGroup?.items).toEqual([conversations[0]])
      expect(yesterdayGroup?.items).toEqual([conversations[1]])
      expect(weekGroup?.items).toEqual([conversations[3]]) // within-week (after 7 days ago)
      expect(olderGroup?.items).toEqual([conversations[2]]) // week-boundary (exactly 7 days ago)
    })

    it('should handle different time zones correctly', () => {
      const conversations = [
        // UTC time that might be different day in different timezone
        createConversation('utc', 'UTC conv', '2024-01-14T23:30:00Z'),
        // Local timezone consideration
        createConversation('late', 'Late conv', '2024-01-15T23:59:59Z')
      ]
      
      const result = groupConversations(conversations)
      
      // Should group based on the system's local date calculation
      expect(result.some(g => g.items.length > 0)).toBe(true)
    })

    it('should handle invalid date strings gracefully', () => {
      const conversations = [
        createConversation('invalid', 'Invalid date', 'invalid-date'),
        createConversation('valid', 'Valid conv', '2024-01-15T09:00:00Z')
      ]
      
      const result = groupConversations(conversations)
      
      // Should not crash and should process valid conversations
      expect(result.length).toBeGreaterThanOrEqual(0)
      const validConvFound = result.some(group => 
        group.items.some(item => item.conversationId === 'valid')
      )
      expect(validConvFound).toBe(true)
    })

    it('should preserve conversation object properties', () => {
      const conversation: ConversationSummary = {
        conversationId: 'test',
        title: 'Test conv',
        updatedAt: '2024-01-15T09:00:00Z',
        createdAt: '2024-01-15T09:00:00Z',
        messageCount: 0,
        productId: 'test-product'
      }
      
      const result = groupConversations([conversation])
      
      expect(result[0].items[0]).toEqual(conversation)
    })

    it('should maintain original order within groups', () => {
      const conversations = [
        createConversation('today1', 'First', '2024-01-15T08:00:00Z'),
        createConversation('today2', 'Second', '2024-01-15T09:00:00Z'),
        createConversation('today3', 'Third', '2024-01-15T10:00:00Z')
      ]
      
      const result = groupConversations(conversations)
      
      expect(result[0].items).toEqual(conversations)
    })
  })

  describe('integration tests', () => {
    it('should save and load messages correctly', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Test message' },
        { id: '2', role: 'assistant', content: 'Response', thinkingSteps: [] }
      ]
      
      saveMessagesToStorage('integration-test', messages)
      const loaded = loadMessagesFromStorage('integration-test')
      
      expect(loaded).toEqual(messages)
    })

    it('should handle conversation workflow', () => {
      const conversationId = 'workflow-test'
      
      // Start with empty conversation
      expect(loadMessagesFromStorage(conversationId)).toEqual([])
      
      // Add first message
      const messages1 = [{ id: '1', role: 'user' as const, content: 'Hello' }]
      saveMessagesToStorage(conversationId, messages1)
      expect(loadMessagesFromStorage(conversationId)).toEqual(messages1)
      
      // Add response
      const messages2 = [
        ...messages1,
        { id: '2', role: 'assistant' as const, content: 'Hi there!' }
      ]
      saveMessagesToStorage(conversationId, messages2)
      expect(loadMessagesFromStorage(conversationId)).toEqual(messages2)
    })

    it('should handle realistic conversation grouping scenario', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
      
      const conversations: ConversationSummary[] = [
        {
          conversationId: '1',
          title: 'Debug API issue',
          updatedAt: '2024-01-15T09:30:00Z', // Today
          createdAt: '2024-01-15T08:00:00Z',
          messageCount: 0,
        },
        {
          conversationId: '2', 
          title: 'React component help',
          updatedAt: '2024-01-14T16:20:00Z', // Yesterday
          createdAt: '2024-01-14T10:00:00Z',
          messageCount: 0,
        },
        {
          conversationId: '3',
          title: 'Database optimization',
          updatedAt: '2024-01-10T11:00:00Z', // 5 days ago
          createdAt: '2024-01-10T09:00:00Z',
          messageCount: 0,
        },
        {
          conversationId: '4',
          title: 'Old project discussion', 
          updatedAt: '2023-12-20T14:30:00Z', // Last month
          createdAt: '2023-12-20T10:00:00Z',
          messageCount: 0,
        }
      ]
      
      const groups = groupConversations(conversations)
      
      expect(groups).toEqual([
        {
          label: 'Today',
          items: [conversations[0]]
        },
        {
          label: 'Yesterday', 
          items: [conversations[1]]
        },
        {
          label: 'Previous 7 days',
          items: [conversations[2]]
        },
        {
          label: 'Older',
          items: [conversations[3]]
        }
      ])
    })
  })
})