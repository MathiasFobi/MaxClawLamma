/**
 * Token Budget Manager
 * Tracks usage and enforces budget limits per session
 */

import type {
  TokenBudgetConfig,
  TokenUsage,
  BudgetStatus,
  BudgetCheckResult,
  BudgetSummary,
  SessionBudget
} from './types.js';
import {
  DEFAULT_BUDGET_CONFIG,
  createBudgetConfig,
  createEmptyUsage,
  calculateBudgetStatus,
  projectUsage,
  shouldCompactContext,
  getStopReason
} from './types.js';

export class BudgetManager {
  private budgets: Map<string, SessionBudget> = new Map();
  private globalUsage: TokenUsage = createEmptyUsage();
  private defaultConfig: TokenBudgetConfig;

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.defaultConfig = createBudgetConfig(config);
  }

  createSessionBudget(
    sessionId: string,
    config?: Partial<TokenBudgetConfig>
  ): SessionBudget {
    const budget: SessionBudget = {
      sessionId,
      config: { ...this.defaultConfig, ...config },
      usage: createEmptyUsage(),
      createdAt: Date.now(),
      lastUpdatedAt: Date.now()
    };
    this.budgets.set(sessionId, budget);
    return budget;
  }

  getOrCreateBudget(sessionId: string): SessionBudget {
    return this.budgets.get(sessionId) || this.createSessionBudget(sessionId);
  }

  getBudget(sessionId: string): SessionBudget | undefined {
    return this.budgets.get(sessionId);
  }

  updateUsage(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
    cost?: number
  ): BudgetStatus {
    const budget = this.getOrCreateBudget(sessionId);
    
    budget.usage.inputTokens += inputTokens;
    budget.usage.outputTokens += outputTokens;
    budget.usage.totalTokens = budget.usage.inputTokens + budget.usage.outputTokens;
    budget.usage.turnCount += 1;
    if (cost !== undefined) {
      budget.usage.cost = (budget.usage.cost || 0) + cost;
    }
    budget.lastUpdatedAt = Date.now();

    this.globalUsage.inputTokens += inputTokens;
    this.globalUsage.outputTokens += outputTokens;
    this.globalUsage.totalTokens += inputTokens + outputTokens;
    this.globalUsage.turnCount += 1;
    if (cost !== undefined) {
      this.globalUsage.cost = (this.globalUsage.cost || 0) + cost;
    }

    return this.getStatus(sessionId);
  }

  recordTurn(sessionId: string): void {
    const budget = this.budgets.get(sessionId);
    if (budget) {
      budget.usage.turnCount += 1;
      budget.lastUpdatedAt = Date.now();
    }
    this.globalUsage.turnCount += 1;
  }

  getStatus(sessionId: string): BudgetStatus {
    const budget = this.getOrCreateBudget(sessionId);
    return calculateBudgetStatus(budget.usage, budget.config);
  }

  checkBudget(
    sessionId: string,
    inputTokens?: number
  ): BudgetCheckResult {
    const budget = this.getOrCreateBudget(sessionId);
    const status = calculateBudgetStatus(budget.usage, budget.config);
    
    if (inputTokens !== undefined) {
      const projected = projectUsage(
        budget.usage,
        inputTokens,
        budget.config.maxOutputTokens,
        budget.config
      );
      const projectedStatus = calculateBudgetStatus(projected, budget.config);
      
      if (projectedStatus.exceeded) {
        const stopReason = getStopReason(projectedStatus, budget.config) || 'projected_overflow';
        return { allowed: false, stopReason, status: projectedStatus };
      }
    }

    if (status.exceeded) {
      const stopReason = getStopReason(status, budget.config) || 'budget_exceeded';
      return { allowed: false, stopReason, status };
    }

    return { allowed: true, status };
  }

  getSummary(sessionId: string): BudgetSummary {
    const budget = this.getOrCreateBudget(sessionId);
    const status = calculateBudgetStatus(budget.usage, budget.config);
    const canContinue = !status.exceeded;
    const shouldCompact = shouldCompactContext(budget.usage.turnCount, budget.config);

    let nextWarningAt: number | undefined;
    if (status.warningTriggered === false && budget.config.warningAtPercentage) {
      nextWarningAt = budget.config.maxTotalTokens * (budget.config.warningAtPercentage / 100);
    }

    return {
      sessionId,
      status,
      projectedInput: budget.usage.inputTokens,
      projectedOutput: budget.usage.outputTokens,
      projectedTotal: budget.usage.totalTokens,
      canContinue,
      shouldCompact,
      nextWarningAt
    };
  }

  shouldCompact(sessionId: string): boolean {
    const budget = this.budgets.get(sessionId);
    if (!budget) return false;
    return shouldCompactContext(budget.usage.turnCount, budget.config);
  }

  compact(sessionId: string): void {
    const budget = this.budgets.get(sessionId);
    if (!budget) return;

    const preservedTurns = Math.floor(budget.config.compactAfterTurns / 2);
    budget.usage.inputTokens = Math.floor(budget.usage.inputTokens * 0.5);
    budget.usage.outputTokens = Math.floor(budget.usage.outputTokens * 0.5);
    budget.usage.totalTokens = budget.usage.inputTokens + budget.usage.outputTokens;
    budget.usage.turnCount = preservedTurns;
    budget.lastUpdatedAt = Date.now();
  }

  reset(sessionId: string): void {
    const budget = this.budgets.get(sessionId);
    if (budget) {
      budget.usage = createEmptyUsage();
      budget.lastUpdatedAt = Date.now();
    }
  }

  delete(sessionId: string): void {
    this.budgets.delete(sessionId);
  }

  getGlobalUsage(): TokenUsage {
    return { ...this.globalUsage };
  }

  getAllBudgets(): SessionBudget[] {
    return Array.from(this.budgets.values());
  }

  getActiveSessions(): string[] {
    const now = Date.now();
    const timeout = 30 * 60 * 1000;
    return Array.from(this.budgets.entries())
      .filter(([, budget]) => now - budget.lastUpdatedAt < timeout)
      .map(([sessionId]) => sessionId);
  }

  cleanup(timeoutMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [sessionId, budget] of this.budgets.entries()) {
      if (now - budget.lastUpdatedAt > timeoutMs) {
        this.budgets.delete(sessionId);
        cleaned++;
      }
    }
    return cleaned;
  }

  setDefaultConfig(config: Partial<TokenBudgetConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  toJSON(): Record<string, unknown> {
    return {
      defaultConfig: this.defaultConfig,
      globalUsage: this.globalUsage,
      activeSessions: this.budgets.size,
      sessionIds: Array.from(this.budgets.keys())
    };
  }
}
