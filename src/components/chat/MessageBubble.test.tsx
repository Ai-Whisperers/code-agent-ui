import { render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'
import type { ChatMessage, ThinkingStep } from '@/types/api'

// Mock the icon components
vi.mock('lucide-react', () => ({
  User: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="user-icon" data-size={size} className={className} />
  ),
  Bot: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="bot-icon" data-size={size} className={className} />
  ),
}))

// Mock the child components
vi.mock('./MarkdownMessage', () => ({
  MarkdownMessage: ({ content }: { content: string }) => (
    <div data-testid="markdown-message">{content}</div>
  ),
}))

vi.mock('./ThinkingPanel', () => ({
  ThinkingPanel: ({ steps, isLive }: { steps: ThinkingStep[]; isLive: boolean }) => (
    <div data-testid="thinking-panel" data-steps={steps.length} data-is-live={isLive}>
      Thinking Panel
    </div>
  ),
}))

describe('MessageBubble', () => {
  const createUserMessage = (content: string, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'user-msg-1',
    role: 'user',
    content,
    ...overrides,
  })

  const createAssistantMessage = (content: string, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'assistant-msg-1',
    role: 'assistant',
    content,
    ...overrides,
  })

  describe('user messages', () => {
    it('renders user message with correct layout', () => {
      const message = createUserMessage('Hello, how are you?')
      render(<MessageBubble message={message} />)

      // Check message content
      const content = screen.getByText('Hello, how are you?')
      expect(content).toBeInTheDocument()

      // Check user icon
      const userIcon = screen.getByTestId('user-icon')
      expect(userIcon).toBeInTheDocument()
      expect(userIcon).toHaveAttribute('data-size', '15')

      // Should not have bot icon
      expect(screen.queryByTestId('bot-icon')).not.toBeInTheDocument()

      // Should not have markdown message component (user messages render content directly)
      expect(screen.queryByTestId('markdown-message')).not.toBeInTheDocument()

      // Should not have thinking panel
      expect(screen.queryByTestId('thinking-panel')).not.toBeInTheDocument()
    })

    it('applies correct styles to user message container', () => {
      const message = createUserMessage('Test message')
      const { container } = render(<MessageBubble message={message} />)

      const messageContainer = container.querySelector('.flex.justify-end.gap-3')
      expect(messageContainer).toBeInTheDocument()

      const messageContent = container.querySelector('.bg-\\[var\\(--color-buttons-button-primary\\)\\]')
      expect(messageContent).toBeInTheDocument()
      expect(messageContent?.className).toContain('text-white')
      expect(messageContent?.className).toContain('rounded-tr-sm')
    })

    it('handles empty user message', () => {
      const message = createUserMessage('')
      render(<MessageBubble message={message} />)

      expect(screen.getByTestId('user-icon')).toBeInTheDocument()
      // Empty content should still be rendered
      const contentElement = screen.getByText('')
      expect(contentElement).toBeInTheDocument()
    })

    it('handles multiline user message with whitespace preservation', () => {
      const message = createUserMessage('Line 1\nLine 2\nLine 3')
      const { container } = render(<MessageBubble message={message} />)

      const messageContent = container.querySelector('.whitespace-pre-wrap')
      expect(messageContent).toBeInTheDocument()
      expect(messageContent).toHaveTextContent('Line 1\nLine 2\nLine 3')
    })

    it('handles very long user message', () => {
      const longMessage = 'A'.repeat(1000)
      const message = createUserMessage(longMessage)
      const { container } = render(<MessageBubble message={message} />)

      const messageContent = container.querySelector('.max-w-\\[80\\%\\]')
      expect(messageContent).toBeInTheDocument()
      expect(messageContent).toHaveTextContent(longMessage)
    })

    it('handles special characters in user message', () => {
      const specialMessage = 'Special chars: @#$%^&*()[]{}|\\;"\'<>?/~`'
      const message = createUserMessage(specialMessage)
      render(<MessageBubble message={message} />)

      expect(screen.getByText(specialMessage)).toBeInTheDocument()
    })

    it('applies correct icon styles for user', () => {
      const message = createUserMessage('Test')
      render(<MessageBubble message={message} />)

      const userIcon = screen.getByTestId('user-icon')
      expect(userIcon.className).toContain('text-[var(--color-fonts-font-color-support)]')
    })
  })

  describe('assistant messages', () => {
    it('renders assistant message with correct layout', () => {
      const message = createAssistantMessage('Hello! I can help you with that.')
      render(<MessageBubble message={message} />)

      // Check bot icon
      const botIcon = screen.getByTestId('bot-icon')
      expect(botIcon).toBeInTheDocument()
      expect(botIcon).toHaveAttribute('data-size', '15')

      // Check markdown message component
      const markdownMessage = screen.getByTestId('markdown-message')
      expect(markdownMessage).toBeInTheDocument()
      expect(markdownMessage).toHaveTextContent('Hello! I can help you with that.')

      // Should not have user icon
      expect(screen.queryByTestId('user-icon')).not.toBeInTheDocument()
    })

    it('applies correct styles to assistant message container', () => {
      const message = createAssistantMessage('Test response')
      const { container } = render(<MessageBubble message={message} />)

      const messageContainer = container.querySelector('.flex.gap-3')
      expect(messageContainer).toBeInTheDocument()

      const messageContent = container.querySelector('.bg-\\[var\\(--color-cards-card-background\\)\\]')
      expect(messageContent).toBeInTheDocument()
      expect(messageContent?.className).toContain('border')
      expect(messageContent?.className).toContain('rounded-tl-sm')
    })

    it('renders thinking panel when thinking steps are present', () => {
      const thinkingSteps: ThinkingStep[] = [
        { kind: 'thought', text: 'Let me think about this...', timestamp: Date.now() },
        { kind: 'tool', name: 'search', status: 'completed', startTime: Date.now() },
      ]
      
      const message = createAssistantMessage('Here is my response', { thinkingSteps })
      render(<MessageBubble message={message} />)

      const thinkingPanel = screen.getByTestId('thinking-panel')
      expect(thinkingPanel).toBeInTheDocument()
      expect(thinkingPanel).toHaveAttribute('data-steps', '2')
      expect(thinkingPanel).toHaveAttribute('data-is-live', 'false')

      // Should also have the markdown message
      expect(screen.getByTestId('markdown-message')).toBeInTheDocument()
    })

    it('does not render thinking panel when no thinking steps', () => {
      const message = createAssistantMessage('Simple response')
      render(<MessageBubble message={message} />)

      expect(screen.queryByTestId('thinking-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('markdown-message')).toBeInTheDocument()
    })

    it('does not render thinking panel when thinking steps is empty array', () => {
      const message = createAssistantMessage('Response', { thinkingSteps: [] })
      render(<MessageBubble message={message} />)

      expect(screen.queryByTestId('thinking-panel')).not.toBeInTheDocument()
    })

    it('handles assistant message with empty content', () => {
      const message = createAssistantMessage('')
      render(<MessageBubble message={message} />)

      expect(screen.getByTestId('bot-icon')).toBeInTheDocument()
      expect(screen.getByTestId('markdown-message')).toBeInTheDocument()
    })

    it('handles markdown content in assistant message', () => {
      const markdownContent = '# Title\n\nSome **bold** text with `code`'
      const message = createAssistantMessage(markdownContent)
      render(<MessageBubble message={message} />)

      const markdownMessage = screen.getByTestId('markdown-message')
      expect(markdownMessage).toHaveTextContent(markdownContent)
    })

    it('applies correct icon styles for assistant', () => {
      const message = createAssistantMessage('Test')
      render(<MessageBubble message={message} />)

      const botIcon = screen.getByTestId('bot-icon')
      expect(botIcon.className).toContain('text-white')
    })

    it('handles complex thinking steps', () => {
      const thinkingSteps: ThinkingStep[] = [
        { 
          kind: 'thought', 
          text: 'Analyzing the problem...', 
          timestamp: 1234567890 
        },
        { 
          kind: 'tool', 
          name: 'code_search', 
          input: { query: 'test' },
          result: 'Found 5 results',
          status: 'completed',
          startTime: 1234567890,
          endTime: 1234567900
        },
        { 
          kind: 'tool', 
          name: 'file_read', 
          status: 'error',
          startTime: 1234567900
        }
      ]
      
      const message = createAssistantMessage('Based on my analysis...', { thinkingSteps })
      render(<MessageBubble message={message} />)

      const thinkingPanel = screen.getByTestId('thinking-panel')
      expect(thinkingPanel).toHaveAttribute('data-steps', '3')
    })
  })

  describe('memo behavior', () => {
    it('should memoize component to prevent unnecessary re-renders', () => {
      const message = createUserMessage('Test message')
      const { rerender } = render(<MessageBubble message={message} />)

      // Render with same message
      rerender(<MessageBubble message={message} />)
      
      // Should still render correctly
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })

    it('should re-render when message changes', () => {
      const message1 = createUserMessage('First message')
      const message2 = createUserMessage('Second message')
      
      const { rerender } = render(<MessageBubble message={message1} />)
      expect(screen.getByText('First message')).toBeInTheDocument()

      rerender(<MessageBubble message={message2} />)
      expect(screen.getByText('Second message')).toBeInTheDocument()
      expect(screen.queryByText('First message')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles message with null thinking steps', () => {
      const message = createAssistantMessage('Test', { thinkingSteps: null as any })
      render(<MessageBubble message={message} />)

      expect(screen.queryByTestId('thinking-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('markdown-message')).toBeInTheDocument()
    })

    it('handles message with undefined thinking steps', () => {
      const message = createAssistantMessage('Test', { thinkingSteps: undefined })
      render(<MessageBubble message={message} />)

      expect(screen.queryByTestId('thinking-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('markdown-message')).toBeInTheDocument()
    })

    it('handles invalid role gracefully', () => {
      const message = { 
        ...createUserMessage('Test'), 
        role: 'invalid' as any 
      }
      render(<MessageBubble message={message} />)

      // Should default to assistant layout
      expect(screen.getByTestId('bot-icon')).toBeInTheDocument()
      expect(screen.getByTestId('markdown-message')).toBeInTheDocument()
    })

    it('handles null content', () => {
      const message = createUserMessage(null as any)
      render(<MessageBubble message={message} />)

      expect(screen.getByTestId('user-icon')).toBeInTheDocument()
    })

    it('handles very long message content', () => {
      const longContent = 'Very '.repeat(1000) + 'long message'
      const message = createAssistantMessage(longContent)
      render(<MessageBubble message={message} />)

      const markdownMessage = screen.getByTestId('markdown-message')
      expect(markdownMessage).toHaveTextContent(longContent)
    })

    it('preserves message structure with complex data', () => {
      const complexMessage: ChatMessage = {
        id: 'complex-msg',
        role: 'assistant',
        content: 'Complex response with special characters: \n\t\r\\"\\\'',
        thinkingSteps: [
          { 
            kind: 'thought', 
            text: 'Complex thought with unicode: 🤔 💭', 
            timestamp: Date.now() 
          }
        ]
      }

      render(<MessageBubble message={complexMessage} />)

      expect(screen.getByTestId('thinking-panel')).toBeInTheDocument()
      expect(screen.getByTestId('markdown-message')).toBeInTheDocument()
    })
  })

  describe('layout and styling', () => {
    it('user message has correct flex layout', () => {
      const message = createUserMessage('Test')
      const { container } = render(<MessageBubble message={message} />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('flex')
      expect(wrapper.className).toContain('justify-end')
      expect(wrapper.className).toContain('gap-3')
    })

    it('assistant message has correct flex layout', () => {
      const message = createAssistantMessage('Test')
      const { container } = render(<MessageBubble message={message} />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('flex')
      expect(wrapper.className).toContain('gap-3')
      expect(wrapper.className).not.toContain('justify-end')
    })

    it('user icon container has correct styles', () => {
      const message = createUserMessage('Test')
      const { container } = render(<MessageBubble message={message} />)

      const iconContainer = container.querySelector('.w-8.h-8.rounded-full')
      expect(iconContainer).toBeInTheDocument()
      expect(iconContainer?.className).toContain('shrink-0')
      expect(iconContainer?.className).toContain('mt-0.5')
    })

    it('bot icon container has correct styles', () => {
      const message = createAssistantMessage('Test')
      const { container } = render(<MessageBubble message={message} />)

      const iconContainer = container.querySelector('.w-8.h-8.rounded-full')
      expect(iconContainer).toBeInTheDocument()
      expect(iconContainer?.className).toContain('shrink-0')
      expect(iconContainer?.className).toContain('mt-0.5')
      expect(iconContainer?.className).toContain('bg-[var(--color-buttons-button-primary)]')
    })

    it('assistant content container has correct responsive styles', () => {
      const message = createAssistantMessage('Test')
      const { container } = render(<MessageBubble message={message} />)

      const contentContainer = container.querySelector('.flex-1.min-w-0')
      expect(contentContainer).toBeInTheDocument()
      expect(contentContainer?.className).toContain('px-4')
      expect(contentContainer?.className).toContain('py-3')
    })
  })
})