/**
 * Stream Event Emitter
 * Provides real-time event streaming for frontend UI updates
 */

import type { EventEmitter } from 'events';
import type {
  StreamEvent,
  TypedStreamEvent,
  StreamEventType
} from './types.js';

export type StreamEventListener = (event: StreamEvent) => void | Promise<void>;

export class StreamEmitter {
  private sessionId: string;
  private turnCounter: number = 0;
  private enabled: boolean = true;
  private eventEmitter: EventEmitter;
  private streamListeners: Map<string, StreamEventListener[]> = new Map();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    // Create a minimal EventEmitter for the 'event' symbol
    this.eventEmitter = new (require('events').EventEmitter)();
    this.eventEmitter.setMaxListeners(100);
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  incrementTurn(): number {
    return ++this.turnCounter;
  }

  getTurnCount(): number {
    return this.turnCounter;
  }

  resetTurns(): void {
    this.turnCounter = 0;
  }

  emitEvent(event: StreamEvent): boolean {
    if (!this.enabled) {
      return false;
    }
    this.eventEmitter.emit('event', event);
    return true;
  }

  onEvent(listener: StreamEventListener): () => void {
    this.eventEmitter.on('event', listener);
    return () => this.eventEmitter.off('event', listener);
  }

  onceEvent(listener: StreamEventListener): () => void {
    this.eventEmitter.once('event', listener);
    return () => this.eventEmitter.off('event', listener);
  }

  sessionStart(data: {
    sessionKey: string;
    channel: string;
    chatId: string;
    model: string;
    toolsCount: number;
  }): void {
    this.emitEvent({
      type: 'session_start',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data
    });
  }

  sessionEnd(data: { reason?: string } = {}): void {
    this.emitEvent({
      type: 'session_end',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data
    });
  }

  messageStart(prompt: string, messageId?: string): void {
    this.emitEvent({
      type: 'message_start',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { prompt, messageId }
    });
  }

  messageDelta(content: string, isPartial: boolean = true): void {
    this.emitEvent({
      type: 'message_delta',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { content, delta: isPartial }
    });
  }

  messageStop(usage: {
    inputTokens: number;
    outputTokens: number;
  }, stopReason: string): void {
    this.emitEvent({
      type: 'message_stop',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: {
        stopReason,
        usage: {
          ...usage,
          totalTokens: usage.inputTokens + usage.outputTokens
        },
        turns: this.turnCounter
      }
    });
  }

  toolMatch(tools: string[], routingScore?: Record<string, number>): void {
    this.emitEvent({
      type: 'tool_match',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { tools, routingScore }
    });
  }

  toolStart(toolName: string, toolCallId: string, params?: Record<string, unknown>): void {
    this.emitEvent({
      type: 'tool_start',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { toolName, toolCallId, params }
    });
  }

  toolResult(
    toolName: string,
    toolCallId: string,
    success: boolean,
    result?: string,
    error?: string,
    startTime?: number
  ): void {
    const durationMs = startTime ? Date.now() - startTime : 0;
    this.emitEvent({
      type: 'tool_result',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { toolName, toolCallId, success, result, error, durationMs }
    });
  }

  toolError(toolName: string, error: string, retryable: boolean = true): void {
    this.emitEvent({
      type: 'tool_error',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { toolName, error, retryable }
    });
  }

  toolConfirm(toolName: string, reason: string, capabilities: string[]): void {
    this.emitEvent({
      type: 'tool_confirm',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { toolName, reason, capabilities }
    });
  }

  permissionDenial(toolName: string, reason: string, requiredPermission: string): void {
    this.emitEvent({
      type: 'permission_denial',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { toolName, reason, requiredPermission }
    });
  }

  budgetWarning(
    budgetType: 'tokens' | 'turns' | 'cost',
    current: number,
    limit: number
  ): void {
    this.emitEvent({
      type: 'budget_warning',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: {
        budgetType,
        current,
        limit,
        percentage: Math.round((current / limit) * 100)
      }
    });
  }

  budgetExceeded(
    budgetType: 'tokens' | 'turns' | 'cost',
    final: number,
    limit: number,
    stopReason: string
  ): void {
    this.emitEvent({
      type: 'budget_exceeded',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { budgetType, final, limit, stopReason }
    });
  }

  contextCompact(
    previousTokens: number,
    newTokens: number,
    turnsPreserved: number
  ): void {
    this.emitEvent({
      type: 'context_compact',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: {
        previousTokens,
        newTokens,
        compressedTokens: previousTokens - newTokens,
        turnsPreserved
      }
    });
  }

  turnStart(turnNumber: number, maxTurns: number): void {
    this.turnCounter = turnNumber;
    this.emitEvent({
      type: 'turn_start',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: turnNumber,
      data: { turnNumber, maxTurns }
    });
  }

  turnStop(turnNumber: number, stopReason: string): void {
    this.emitEvent({
      type: 'turn_stop',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: turnNumber,
      data: { turnNumber, stopReason }
    });
  }

  routingMatch(matches: Array<{
    name: string;
    kind: 'tool' | 'command';
    score: number;
    source?: string;
  }>): void {
    this.emitEvent({
      type: 'routing_match',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter,
      data: { matches }
    });
  }

  error(error: string, code?: string, recoverable: boolean = true): void {
    this.emitEvent({
      type: 'error',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data: { error, code, recoverable }
    });
  }

  ping(): void {
    this.emitEvent({
      type: 'ping',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter
    });
  }

  pong(): void {
    this.emitEvent({
      type: 'pong',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      turnId: this.turnCounter
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      turnCounter: this.turnCounter,
      enabled: this.enabled,
      listenerCount: this.eventEmitter.listenerCount('event')
    };
  }
}

export class MultiStreamEmitter {
  private emitters: Map<string, StreamEmitter> = new Map();

  create(sessionId: string): StreamEmitter {
    const emitter = new StreamEmitter(sessionId);
    this.emitters.set(sessionId, emitter);
    return emitter;
  }

  get(sessionId: string): StreamEmitter | undefined {
    return this.emitters.get(sessionId);
  }

  delete(sessionId: string): void {
    const emitter = this.emitters.get(sessionId);
    if (emitter) {
      emitter.toJSON(); // Clean up
      this.emitters.delete(sessionId);
    }
  }

  has(sessionId: string): boolean {
    return this.emitters.has(sessionId);
  }

  broadcast(event: StreamEvent): void {
    for (const emitter of this.emitters.values()) {
      emitter.emitEvent(event);
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.emitters.keys());
  }

  clear(): void {
    for (const [sessionId] of this.emitters) {
      this.delete(sessionId);
    }
  }
}
