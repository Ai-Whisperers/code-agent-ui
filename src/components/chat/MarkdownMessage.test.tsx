import { render, screen } from '@testing-library/react'
import { MarkdownMessage } from './MarkdownMessage'

// Mock react-markdown and remark-gfm
vi.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children, components }: { children: string; components: any }) => (
    <div data-testid="markdown-content" data-components={Object.keys(components || {}).join(',')}>
      {children}
    </div>
  ),
}))

vi.mock('remark-gfm', () => ({
  __esModule: true,
  default: vi.fn(() => 'remark-gfm-plugin'),
}))

vi.mock('./markdownComponents', () => ({
  markdownComponents: {
    code: 'mocked-code-component',
    pre: 'mocked-pre-component',
    a: 'mocked-link-component'
  }
}))

describe('MarkdownMessage', () => {
  it('renders markdown content', () => {
    render(<MarkdownMessage content="# Hello World" />)
    
    const content = screen.getByTestId('markdown-content')
    expect(content).toBeInTheDocument()
    expect(content).toHaveTextContent('# Hello World')
  })

  it('passes custom markdown components', () => {
    render(<MarkdownMessage content="Some content" />)
    
    const content = screen.getByTestId('markdown-content')
    expect(content).toHaveAttribute('data-components', 'code,pre,a')
  })

  it('handles empty content', () => {
    render(<MarkdownMessage content="" />)
    
    const content = screen.getByTestId('markdown-content')
    expect(content).toBeInTheDocument()
    expect(content).toHaveTextContent('')
  })

  it('handles plain text content', () => {
    render(<MarkdownMessage content="Just plain text without markdown" />)
    
    const content = screen.getByTestId('markdown-content')
    expect(content).toHaveTextContent('Just plain text without markdown')
  })

  it('handles markdown with special characters', () => {
    const markdownContent = 'Text with **bold** and *italic* and `code`'
    render(<MarkdownMessage content={markdownContent} />)
    
    const content = screen.getByTestId('markdown-content')
    expect(content).toHaveTextContent(markdownContent)
  })

  it('handles multiline content', () => {
    const markdownContent = `# Title
    
Some paragraph text.

- List item 1
- List item 2

\`\`\`javascript
console.log('code block');
\`\`\``
    
    render(<MarkdownMessage content={markdownContent} />)
    
    const content = screen.getByTestId('markdown-content')
    expect(content).toHaveTextContent(markdownContent)
  })

  it('handles content with newlines', () => {
    const content = 'Line 1\nLine 2\nLine 3'
    render(<MarkdownMessage content={content} />)
    
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(content)
  })

  it('handles content with HTML entities', () => {
    const content = 'Text with &lt;html&gt; entities &amp; symbols'
    render(<MarkdownMessage content={content} />)
    
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(content)
  })

  it('handles very long content', () => {
    const longContent = 'A'.repeat(10000)
    render(<MarkdownMessage content={longContent} />)
    
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(longContent)
  })

  it('handles content with unicode characters', () => {
    const content = 'Unicode: 🚀 emoji, 中文 characters, and symbols ∑∏∆'
    render(<MarkdownMessage content={content} />)
    
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(content)
  })

  it('handles markdown tables (GFM feature)', () => {
    const tableContent = `| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`
    
    render(<MarkdownMessage content={tableContent} />)
    
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(tableContent)
  })

  it('handles strikethrough text (GFM feature)', () => {
    const content = 'This is ~~strikethrough~~ text'
    render(<MarkdownMessage content={content} />)
    
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(content)
  })

  it('handles task lists (GFM feature)', () => {
    const content = `- [x] Completed task
- [ ] Incomplete task`
    
    render(<MarkdownMessage content={content} />)
    
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(content)
  })

  it('handles autolinks (GFM feature)', () => {
    const content = 'Visit https://example.com for more info'
    render(<MarkdownMessage content={content} />)
    
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(content)
  })

  it('handles null content gracefully', () => {
    render(<MarkdownMessage content={null as any} />)
    
    const content = screen.getByTestId('markdown-content')
    expect(content).toBeInTheDocument()
  })

  it('handles undefined content gracefully', () => {
    render(<MarkdownMessage content={undefined as any} />)
    
    const content = screen.getByTestId('markdown-content')
    expect(content).toBeInTheDocument()
  })

  it('renders different content types correctly', () => {
    const testCases = [
      { name: 'headers', content: '# H1\n## H2\n### H3' },
      { name: 'lists', content: '1. Item 1\n2. Item 2\n\n- Bullet 1\n- Bullet 2' },
      { name: 'emphasis', content: '**bold** *italic* ***both***' },
      { name: 'code', content: 'Inline `code` and\n```\ncode block\n```' },
      { name: 'links', content: '[Link text](https://example.com)' },
      { name: 'blockquotes', content: '> This is a quote\n> with multiple lines' },
    ]

    testCases.forEach(({ name, content }) => {
      const { unmount } = render(<MarkdownMessage content={content} />)
      
      const element = screen.getByTestId('markdown-content')
      expect(element).toHaveTextContent(content)
      
      unmount()
    })
  })
})