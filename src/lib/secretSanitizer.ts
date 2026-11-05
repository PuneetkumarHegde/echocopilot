/**
 * Secret & Credential Protection Shield
 * Prevents .env files, private keys, API tokens, passwords, and connection strings
 * from ever being indexed or persisted in EchoCopilot.
 */

// Forbidden file patterns (exact or regex)
const BLOCKED_FILE_PATTERNS: RegExp[] = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|pfx|p12|cer|crt|der|pkcs12)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^(service[-_]account|credentials|client[-_]secret|auth[-_]token).*\.json$/i,
  /(password|passwd|shadow|htpasswd|master\.key)/i,
  /\.keystore$/i,
  /\.jks$/i,
];

// Sensitive secret string patterns to detect and redact
const SECRET_REGEX_RULES: Array<{ name: string; regex: RegExp; replacement: string }> = [
  // Private Keys
  {
    name: 'Private Key Block',
    regex: /-----BEGIN\s+([A-Z0-9\s_-]+)?PRIVATE KEY-----[\s\S]*?-----END\s+([A-Z0-9\s_-]+)?PRIVATE KEY-----/gi,
    replacement: '[REDACTED_PRIVATE_KEY]'
  },
  // OpenAI Keys
  {
    name: 'OpenAI API Key',
    regex: /sk-(?:proj-|live-)?[A-Za-z0-9_-]{20,70}/g,
    replacement: '[REDACTED_OPENAI_KEY]'
  },
  // Anthropic Keys
  {
    name: 'Anthropic API Key',
    regex: /sk-ant-(?:api\d{2}-)?[A-Za-z0-9_-]{30,100}/g,
    replacement: '[REDACTED_ANTHROPIC_KEY]'
  },
  // Groq Keys
  {
    name: 'Groq API Key',
    regex: /gsk_[A-Za-z0-9]{30,80}/g,
    replacement: '[REDACTED_GROQ_KEY]'
  },
  // AWS Access Key ID
  {
    name: 'AWS Access Key',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    replacement: '[REDACTED_AWS_KEY]'
  },
  // JWT Tokens
  {
    name: 'JSON Web Token (JWT)',
    regex: /eyJ[A-Za-z0-9-_]{10,}\.eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]+/g,
    replacement: '[REDACTED_JWT_TOKEN]'
  },
  // Database Connection Strings with Passwords
  {
    name: 'Database URL with Credentials',
    regex: /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s'"]+:[^@\s'"]+@[^\s'"]+/gi,
    replacement: '$1://[REDACTED_USER]:[REDACTED_PWD]@[REDACTED_HOST]'
  },
  // Generic password assignments: password = "xyz"
  {
    name: 'Hardcoded Password Assignment',
    regex: /(password|passwd|api_secret|secret_key|auth_token)\s*[:=]\s*["']([^"']{6,})["']/gi,
    replacement: '$1 = "[REDACTED_CREDENTIAL]"'
  }
];

/**
 * Returns true if the file name or path matches a known secret file format.
 */
export function isSecretFileName(fileNameOrPath: string): boolean {
  if (!fileNameOrPath) return false;
  // Extract just the basename
  const baseName = fileNameOrPath.split(/[\\/]/).pop() || fileNameOrPath;
  return BLOCKED_FILE_PATTERNS.some(pattern => pattern.test(baseName));
}

export interface SanitizationResult {
  sanitized: string;
  isBlockedFile: boolean;
  redactedCount: number;
  warnings: string[];
}

/**
 * Validates and sanitizes text content and source code before storing or indexing.
 */
export function sanitizeSourceCode(content: string, fileName?: string): SanitizationResult {
  const warnings: string[] = [];

  if (fileName && isSecretFileName(fileName)) {
    return {
      sanitized: '',
      isBlockedFile: true,
      redactedCount: 0,
      warnings: [`Blocked sensitive configuration file: "${fileName}". This file will not be indexed.`]
    };
  }

  let sanitized = content;
  let redactedCount = 0;

  for (const rule of SECRET_REGEX_RULES) {
    const matches = sanitized.match(rule.regex);
    if (matches && matches.length > 0) {
      redactedCount += matches.length;
      warnings.push(`Detected and redacted ${matches.length} instance(s) of ${rule.name}.`);
      sanitized = sanitized.replace(rule.regex, rule.replacement);
    }
  }

  return {
    sanitized,
    isBlockedFile: false,
    redactedCount,
    warnings
  };
}

