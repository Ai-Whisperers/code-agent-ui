import { detectSecrets, redactSecrets, SECRET_PATTERNS } from './SecretScanner'

describe('SecretScanner', () => {
  describe('SECRET_PATTERNS', () => {
    it('should export all expected pattern types', () => {
      const expectedTypes = [
        'AWS Access Key',
        'GitHub Token', 
        'Anthropic API Key',
        'OpenAI API Key',
        'Private Key',
        'JWT',
        'Database URL'
      ]
      
      const actualTypes = SECRET_PATTERNS.map(p => p.type)
      expect(actualTypes).toEqual(expectedTypes)
    })

    it('should have valid regex patterns', () => {
      SECRET_PATTERNS.forEach(({ type, regex }) => {
        expect(regex).toBeInstanceOf(RegExp)
        expect(type).toBeTruthy()
      })
    })
  })

  describe('detectSecrets', () => {
    it('should return empty array for text with no secrets', () => {
      const text = 'This is just normal text with no secrets'
      expect(detectSecrets(text)).toEqual([])
    })

    it('should detect AWS Access Key', () => {
      const text = 'Here is my key: AKIAIOSFODNN7EXAMPLE'
      const result = detectSecrets(text)
      expect(result).toContain('AWS Access Key')
      expect(result).toHaveLength(1)
    })

    it('should detect GitHub Token - classic', () => {
      const text = 'token: ghp_1234567890123456789012345678901234567890'
      const result = detectSecrets(text)
      expect(result).toContain('GitHub Token')
    })

    it('should detect GitHub Token - user', () => {
      const text = 'user token: ghu_1234567890123456789012345678901234567890'
      const result = detectSecrets(text)
      expect(result).toContain('GitHub Token')
    })

    it('should detect GitHub Token - org', () => {
      const text = 'org token: gho_1234567890123456789012345678901234567890'
      const result = detectSecrets(text)
      expect(result).toContain('GitHub Token')
    })

    it('should detect GitHub Token - refresh', () => {
      const text = 'refresh: ghr_1234567890123456789012345678901234567890'
      const result = detectSecrets(text)
      expect(result).toContain('GitHub Token')
    })

    it('should detect GitHub Token - server-to-server', () => {
      const text = 'server: ghs_1234567890123456789012345678901234567890'
      const result = detectSecrets(text)
      expect(result).toContain('GitHub Token')
    })

    it('should detect Anthropic API Key', () => {
      const text = 'api key: sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456'
      const result = detectSecrets(text)
      expect(result).toContain('Anthropic API Key')
    })

    it('should detect OpenAI API Key', () => {
      const text = 'openai key: sk-abcdefghijklmnopqrstT'
      const result = detectSecrets(text)
      expect(result).toContain('OpenAI API Key')
    })

    it('should detect Private Key - RSA', () => {
      const text = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCA...'
      const result = detectSecrets(text)
      expect(result).toContain('Private Key')
    })

    it('should detect Private Key - generic', () => {
      const text = '-----BEGIN PRIVATE KEY-----\nMIIEpAIBAAKCA...'
      const result = detectSecrets(text)
      expect(result).toContain('Private Key')
    })

    it('should detect Private Key - EC', () => {
      const text = '-----BEGIN EC PRIVATE KEY-----\nMIIEpAIBAAKCA...'
      const result = detectSecrets(text)
      expect(result).toContain('Private Key')
    })

    it('should detect Private Key - OpenSSH', () => {
      const text = '-----BEGIN OPENSSH PRIVATE KEY-----\nMIIEpAIBAAKCA...'
      const result = detectSecrets(text)
      expect(result).toContain('Private Key')
    })

    it('should detect JWT token', () => {
      const text = 'jwt: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      const result = detectSecrets(text)
      expect(result).toContain('JWT')
    })

    it('should detect PostgreSQL database URL', () => {
      const text = 'db: postgresql://user:password@localhost:5432/dbname'
      const result = detectSecrets(text)
      expect(result).toContain('Database URL')
    })

    it('should detect MySQL database URL', () => {
      const text = 'db: mysql://user:password@localhost:3306/dbname'
      const result = detectSecrets(text)
      expect(result).toContain('Database URL')
    })

    it('should detect MongoDB database URL', () => {
      const text = 'db: mongodb://user:password@localhost:27017/dbname'
      const result = detectSecrets(text)
      expect(result).toContain('Database URL')
    })

    it('should detect multiple different secret types', () => {
      const text = `
        AWS key: AKIAIOSFODNN7EXAMPLE
        GitHub token: ghp_1234567890123456789012345678901234567890  
        JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
      `
      const result = detectSecrets(text)
      expect(result).toContain('AWS Access Key')
      expect(result).toContain('GitHub Token')
      expect(result).toContain('JWT')
      expect(result).toHaveLength(3)
    })

    it('should detect multiple instances of same secret type only once', () => {
      const text = `
        First AWS key: AKIAIOSFODNN7EXAMPLE
        Second AWS key: AKIATEST123456789012
      `
      const result = detectSecrets(text)
      expect(result).toContain('AWS Access Key')
      expect(result).toHaveLength(1)
    })

    it('should handle empty string', () => {
      expect(detectSecrets('')).toEqual([])
    })

    it('should handle special characters and newlines', () => {
      const text = `Here's my config:
      
      AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
      
      # Comment with special chars: !@#$%^&*()
      `
      const result = detectSecrets(text)
      expect(result).toContain('AWS Access Key')
    })
  })

  describe('redactSecrets', () => {
    it('should return unchanged text when no secrets present', () => {
      const text = 'This is safe text with no secrets'
      expect(redactSecrets(text)).toBe(text)
    })

    it('should redact AWS Access Key', () => {
      const text = 'AWS key: AKIAIOSFODNN7EXAMPLE'
      const result = redactSecrets(text)
      expect(result).toBe('AWS key: [REDACTED:AWS_ACCESS_KEY]')
      expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE')
    })

    it('should redact GitHub Token', () => {
      const text = 'GitHub: ghp_1234567890123456789012345678901234567890'
      const result = redactSecrets(text)
      expect(result).toBe('GitHub: [REDACTED:GITHUB_TOKEN]')
      expect(result).not.toContain('ghp_1234567890123456789012345678901234567890')
    })

    it('should redact Anthropic API Key', () => {
      const text = 'Anthropic: sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456'
      const result = redactSecrets(text)
      expect(result).toBe('Anthropic: [REDACTED:ANTHROPIC_API_KEY]')
      expect(result).not.toContain('sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456')
    })

    it('should redact OpenAI API Key', () => {
      const text = 'OpenAI: sk-abcdefghijklmnopqrstT'
      const result = redactSecrets(text)
      expect(result).toBe('OpenAI: [REDACTED:OPENAI_API_KEY]')
      expect(result).not.toContain('sk-abcdefghijklmnopqrstT')
    })

    it('should redact Private Key', () => {
      const text = 'Key: -----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCA...'
      const result = redactSecrets(text)
      expect(result).toBe('Key: [REDACTED:PRIVATE_KEY]\nMIIEpAIBAAKCA...')
      expect(result).not.toContain('-----BEGIN RSA PRIVATE KEY-----')
    })

    it('should redact JWT token', () => {
      const text = 'JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      const result = redactSecrets(text)
      expect(result).toBe('JWT: [REDACTED:JWT]')
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    })

    it('should redact Database URL credentials', () => {
      const text = 'DB: postgresql://user:password@localhost:5432/dbname'
      const result = redactSecrets(text)
      expect(result).toBe('DB: [REDACTED:DATABASE_URL]localhost:5432/dbname')
      expect(result).not.toContain('user:password@')
    })

    it('should redact multiple secrets of different types', () => {
      const text = `
        AWS: AKIAIOSFODNN7EXAMPLE
        GitHub: ghp_1234567890123456789012345678901234567890
      `
      const result = redactSecrets(text)
      expect(result).toContain('[REDACTED:AWS_ACCESS_KEY]')
      expect(result).toContain('[REDACTED:GITHUB_TOKEN]')
      expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE')
      expect(result).not.toContain('ghp_1234567890123456789012345678901234567890')
    })

    it('should redact multiple instances of same secret type', () => {
      const text = `
        First: AKIAIOSFODNN7EXAMPLE
        Second: AKIATEST123456789012
      `
      const result = redactSecrets(text)
      expect(result).toMatch(/First: \[REDACTED:AWS_ACCESS_KEY\]/)
      expect(result).toMatch(/Second: \[REDACTED:AWS_ACCESS_KEY\]/)
      expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE')
      expect(result).not.toContain('AKIATEST123456789012')
    })

    it('should preserve text structure and formatting', () => {
      const text = `Config file:
      
      # Database connection
      DATABASE_URL=postgresql://user:password@localhost/db
      
      # AWS credentials
      AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
      `
      
      const result = redactSecrets(text)
      expect(result).toContain('Config file:')
      expect(result).toContain('# Database connection')
      expect(result).toContain('# AWS credentials')
      expect(result).toContain('[REDACTED:DATABASE_URL]')
      expect(result).toContain('[REDACTED:AWS_ACCESS_KEY]')
    })

    it('should handle empty string', () => {
      expect(redactSecrets('')).toBe('')
    })

    it('should handle text with only whitespace', () => {
      const text = '   \n\t  \n   '
      expect(redactSecrets(text)).toBe(text)
    })

    it('should handle secrets at start and end of text', () => {
      const text = 'AKIAIOSFODNN7EXAMPLE and some text ghp_1234567890123456789012345678901234567890'
      const result = redactSecrets(text)
      expect(result).toBe('[REDACTED:AWS_ACCESS_KEY] and some text [REDACTED:GITHUB_TOKEN]')
    })
  })

  describe('integration tests', () => {
    it('should detect and redact the same secrets consistently', () => {
      const text = `
        Here are some secrets:
        AWS: AKIAIOSFODNN7EXAMPLE
        GitHub: ghp_1234567890123456789012345678901234567890
        Database: postgresql://user:password@localhost/db
      `
      
      const detected = detectSecrets(text)
      const redacted = redactSecrets(text)
      
      expect(detected).toContain('AWS Access Key')
      expect(detected).toContain('GitHub Token') 
      expect(detected).toContain('Database URL')
      
      expect(redacted).toContain('[REDACTED:AWS_ACCESS_KEY]')
      expect(redacted).toContain('[REDACTED:GITHUB_TOKEN]')
      expect(redacted).toContain('[REDACTED:DATABASE_URL]')
    })

    it('should handle complex real-world config example', () => {
      const configText = `
# Application configuration
APP_ENV=production
DEBUG=false

# Database
DATABASE_URL=postgresql://myuser:secretpass123@localhost:5432/myapp

# External APIs  
OPENAI_API_KEY=sk-1234567890abcdefghijklmnT
ANTHROPIC_API_KEY=sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz

# AWS
AWS_ACCESS_KEY_ID=AKIATEST123456789012
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# GitHub
GITHUB_TOKEN=ghp_1234567890123456789012345678901234567890

# JWT Secret
JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
      `
      
      const detected = detectSecrets(configText)
      const redacted = redactSecrets(configText)
      
      expect(detected.length).toBeGreaterThanOrEqual(4)
      expect(detected).toContain('Database URL')
      expect(detected).toContain('OpenAI API Key')
      expect(detected).toContain('AWS Access Key')
      expect(detected).toContain('GitHub Token')
      expect(detected).toContain('JWT')
      
      // All secrets should be redacted
      expect(redacted).not.toContain('myuser:secretpass123@')
      expect(redacted).not.toContain('sk-1234567890abcdefghijklmnT')
      expect(redacted).not.toContain('AKIATEST123456789012')
      expect(redacted).not.toContain('ghp_1234567890123456789012345678901234567890')
      expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
      
      // But should contain redaction markers
      expect(redacted).toContain('[REDACTED:DATABASE_URL]')
      expect(redacted).toContain('[REDACTED:OPENAI_API_KEY]')
      expect(redacted).toContain('[REDACTED:AWS_ACCESS_KEY]')
      expect(redacted).toContain('[REDACTED:GITHUB_TOKEN]')
      expect(redacted).toContain('[REDACTED:JWT]')
    })
  })
})