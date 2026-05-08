export interface AskGuardResult {
  allowed: boolean;
  reason?: string;
  reply?: string;
}

const MAX_ASK_LENGTH = 240;
const MAX_WORDS = 45;

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string; reply: string }> = [
  {
    pattern: /\b(ignore|forget|disregard)\b.*\b(previous|all|system|developer|instructions?)\b/i,
    reason: "prompt injection attempt",
    reply: "no puedo cambiar mis instrucciones internas por chat."
  },
  {
    pattern: /\b(system prompt|developer message|hidden instructions?|reveal your prompt|show your prompt)\b/i,
    reason: "prompt extraction attempt",
    reply: "no puedo revelar instrucciones internas."
  },
  {
    pattern: /\b(write|generate|create|make)\b.*\b(essay|book|script|program|app|website|full code|1000 words|2000 words)\b/i,
    reason: "request too large",
    reply: "eso es muy largo para Twitch chat. Haz una pregunta mas concreta."
  },
  {
    pattern: /\b(hack|phishing|malware|ddos|steal|token|password|credential|exploit)\b/i,
    reason: "unsafe request",
    reply: "no puedo ayudar con eso, pero puedo responder algo seguro."
  }
];

export function inspectAskQuestion(question: string): AskGuardResult {
  const cleaned = question.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return {
      allowed: false,
      reason: "empty question",
      reply: "uso: !ask <pregunta>"
    };
  }

  if (cleaned.length > MAX_ASK_LENGTH) {
    return {
      allowed: false,
      reason: "question too long",
      reply: `pregunta demasiado larga. Maximo ${MAX_ASK_LENGTH} caracteres.`
    };
  }

  if (cleaned.split(" ").length > MAX_WORDS) {
    return {
      allowed: false,
      reason: "too many words",
      reply: "pregunta demasiado compleja. Hazla mas corta y directa."
    };
  }

  const blocked = BLOCKED_PATTERNS.find(({ pattern }) => pattern.test(cleaned));

  if (blocked) {
    return {
      allowed: false,
      reason: blocked.reason,
      reply: blocked.reply
    };
  }

  return { allowed: true };
}
