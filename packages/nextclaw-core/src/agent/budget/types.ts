/**
 * Token Budget System
 * Inspired by Claude Code's QueryEngineConfig
 * Prevents runaway agents by setting token/turn/cost limits per task
 */

export interface TokenBudgetConfig {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  maxTurns: number;
  maxCost?: number;
  compactAfterTurns: number;
  warningAtPercentage?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  turnCount: number;
  cost?: number;
}

export interface BudgetStatus {
  withinBudget: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  maxTokens: number;
  turns: number;
  maxTurns: number;
  cost?: number;
  maxCost?: number;
  warningTriggered: boolean;
  exceeded: boolean;
  percentageUsed: number;
  remainingTokens: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  stopReason?: string;
  status: BudgetStatus;
}

export interface SessionBudget {
  sessionId: string;
  config: TokenBudgetConfig;
  usage: TokenUsage;
  createdAt: number;
  lastUpdatedAt: number;
}

export interface BudgetSummary {
  sessionId: string;
  status: BudgetStatus;
  projectedInput: number;
  projectedOutput: number;
  projectedTotal: number;
  canContinue: boolean;
  shouldCompact: boolean;
  nextWarningAt?: number;
}

export const DEFAULT_BUDGET_CONFIG: TokenBudgetConfig = {
  maxInputTokens: 100000,
  maxOutputTokens: 10000,
  maxTotalTokens: 128000,
  maxTurns: 20,
  compactAfterTurns: 12,
  warningAtPercentage: 80
};

export function createBudgetConfig(overrides?: Partial<TokenBudgetConfig>): TokenBudgetConfig {
  return {
    ...DEFAULT_BUDGET_CONFIG,
    ...overrides
  };
}

export function createEmptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    turnCount: 0,
    cost: 0
  };
}

export function calculateBudgetStatus(
  usage: TokenUsage,
  config: TokenBudgetConfig
): BudgetStatus {
  const totalUsed = usage.totalTokens;
  const maxTokens = config.maxTotalTokens;
  const percentageUsed = maxTokens > 0 ? (totalUsed / maxTokens) * 100 : 0;
  const remainingTokens = Math.max(0, maxTokens - totalUsed);
  const warningTriggered = config.warningAtPercentage 
    ? percentageUsed >= config.warningAtPercentage 
    : percentageUsed >= 80;

  return {
    withinBudget: totalUsed < maxTokens && usage.turnCount < config.maxTurns,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: totalUsed,
    maxTokens,
    turns: usage.turnCount,
    maxTurns: config.maxTurns,
    cost: usage.cost,
    maxCost: config.maxCost,
    warningTriggered,
    exceeded: totalUsed >= maxTokens || usage.turnCount >= config.maxTurns,
    percentageUsed: Math.round(percentageUsed * 100) / 100,
    remainingTokens
  };
}

export function projectUsage(
  currentUsage: TokenUsage,
  inputDelta: number,
  outputEstimate: number,
  config: TokenBudgetConfig
): TokenUsage {
  const projectedInput = currentUsage.inputTokens + inputDelta;
  const projectedOutput = currentUsage.outputTokens + outputEstimate;
  const projectedTotal = projectedInput + projectedOutput;

  return {
    inputTokens: projectedInput,
    outputTokens: projectedOutput,
    totalTokens: projectedTotal,
    turnCount: currentUsage.turnCount + 1,
    cost: currentUsage.cost
  };
}

export function shouldCompactContext(
  turnCount: number,
  config: TokenBudgetConfig
): boolean {
  return turnCount >= config.compactAfterTurns;
}

export function getStopReason(status: BudgetStatus, config: TokenBudgetConfig): string | undefined {
  if (status.totalTokens >= config.maxTotalTokens) {
    return 'max_tokens_exceeded';
  }
  if (status.turns >= config.maxTurns) {
    return 'max_turns_exceeded';
  }
  if (status.cost !== undefined && status.maxCost !== undefined && status.cost >= status.maxCost) {
    return 'max_cost_exceeded';
  }
  if (status.withinBudget === false) {
    return 'budget_exceeded';
  }
  return undefined;
}
