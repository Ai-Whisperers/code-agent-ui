// Secret scanning utilities - pure functions with no React dependencies

export const SECRET_PATTERNS: { type: string; regex: RegExp }[] = [
  { type: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  { type: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,251}/g },
  { type: 'Anthropic API Key', regex: /sk-ant-[a-zA-Z0-9-]{32,}/g },
  { type: 'OpenAI API Key', regex: /sk-[A-Za-z0-9T]{20,}/g },
  { type: 'Private Key', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { type: 'JWT', regex: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g },
  { type: 'Database URL', regex: /(?:postgresql|mysql|mongodb):\/\/[^@\s]+:[^@\s]+@/gi },
]

export function detectSecrets(text: string): string[] {
  const found = new Set<string>()
  for (const { type, regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0
    if (regex.test(text)) found.add(type)
  }
  return [...found]
}

export function redactSecrets(text: string): string {
  let out = text
  for (const { type, regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0
    out = out.replace(regex, `[REDACTED:${type.replace(/ /g, '_').toUpperCase()}]`)
  }
  return out
}
