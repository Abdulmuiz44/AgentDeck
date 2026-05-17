const CHARS_PER_TOKEN = 4;

export interface TokenEstimate {
  totalChars: number;
  estimatedTokens: number;
}

export function estimateTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

export function estimateContentTokens(content: string): TokenEstimate {
  return {
    totalChars: content.length,
    estimatedTokens: estimateTokens(content),
  };
}

export interface RunTokenEstimate {
  estimatedInputTokens: number;
  estimatedCachedTokens: number;
  estimatedFreshTokens: number;
  estimatedSavingsPercent: number;
}

export function computeRunTokenEstimate(
  cachedTokens: number,
  freshTokens: number,
): RunTokenEstimate {
  const total = cachedTokens + freshTokens;
  const savingsPercent = total > 0 ? Math.round((cachedTokens / total) * 100) : 0;
  return {
    estimatedInputTokens: total,
    estimatedCachedTokens: cachedTokens,
    estimatedFreshTokens: freshTokens,
    estimatedSavingsPercent: savingsPercent,
  };
}
