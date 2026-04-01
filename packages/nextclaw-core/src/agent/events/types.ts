/**
 * Stream Events System
 * Enables real-time progress feedback to frontend UI
 * Inspired by Claude Code's streaming event system
 */

export type StreamEventType =
  | 'session_start'
  | 'session_end'
  | 'message_start'
  | 'message_delta'
  | 'message_stop'
  | 'tool_match'
  | 'tool_start'
  | 'tool_result'
  | 'tool_error'
  | 'tool_confirm'
  | 'command_match'
  | 'command_execute'
  | 'permission_denial'
  | 'budget_warning'
  | 'budget_exceeded'
  | 'context_compact'
  | 'turn_start'
  | 'turn_stop'
  | 'routing_match'
  | 'error'
  | 'ping'
  | 'pong';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
  sessionId?: string;
  turnId?: number;
  data?: Record<string, unknown>;
}

export interface SessionStartEvent extends StreamEvent {
  type: 'session_start';
  data: {
    sessionKey: string;
    channel: string;
    chatId: string;
    model: string;
    toolsCount: number;
  };
}

export interface MessageStartEvent extends StreamEvent {
  type: 'message_start';
  data: {
    prompt: string;
    messageId?: string;
  };
}

export interface MessageDeltaEvent extends StreamEvent {
  type: 'message_delta';
  data: {
    content: string;
    delta: boolean;
  };
}

export interface MessageStopEvent extends StreamEvent {
  type: 'message_stop';
  data: {
    stopReason: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    turns: number;
  };
}

export interface ToolMatchEvent extends StreamEvent {
  type: 'tool_match';
  data: {
    tools: string[];
    routingScore?: Record<string, number>;
  };
}

export interface ToolStartEvent extends StreamEvent {
  type: 'tool_start';
  data: {
    toolName: string;
    toolCallId: string;
    params?: Record<string, unknown>;
  };
}

export interface ToolResultEvent extends StreamEvent {
  type: 'tool_result';
  data: {
    toolName: string;
    toolCallId: string;
    success: boolean;
    result?: string;
    error?: string;
    durationMs: number;
  };
}

export interface ToolErrorEvent extends StreamEvent {
  type: 'tool_error';
  data: {
    toolName: string;
    error: string;
    retryable: boolean;
  };
}

export interface ToolConfirmEvent extends StreamEvent {
  type: 'tool_confirm';
  data: {
    toolName: string;
    reason: string;
    capabilities: string[];
  };
}

export interface PermissionDenialEvent extends StreamEvent {
  type: 'permission_denial';
  data: {
    toolName: string;
    reason: string;
    requiredPermission: string;
  };
}

export interface BudgetWarningEvent extends StreamEvent {
  type: 'budget_warning';
  data: {
    budgetType: 'tokens' | 'turns' | 'cost';
    current: number;
    limit: number;
    percentage: number;
  };
}

export interface BudgetExceededEvent extends StreamEvent {
  type: 'budget_exceeded';
  data: {
    budgetType: 'tokens' | 'turns' | 'cost';
    final: number;
    limit: number;
    stopReason: string;
  };
}

export interface ContextCompactEvent extends StreamEvent {
  type: 'context_compact';
  data: {
    previousTokens: number;
    newTokens: number;
    compressedTokens: number;
    turnsPreserved: number;
  };
}

export interface TurnStartEvent extends StreamEvent {
  type: 'turn_start';
  data: {
    turnNumber: number;
    maxTurns: number;
  };
}

export interface TurnStopEvent extends StreamEvent {
  type: 'turn_stop';
  data: {
    turnNumber: number;
    stopReason: string;
  };
}

export interface RoutingMatchEvent extends StreamEvent {
  type: 'routing_match';
  data: {
    matches: Array<{
      name: string;
      kind: 'tool' | 'command';
      score: number;
      source?: string;
    }>;
  };
}

export interface ErrorEvent extends StreamEvent {
  type: 'error';
  data: {
    error: string;
    code?: string;
    recoverable: boolean;
  };
}

export type TypedStreamEvent =
  | SessionStartEvent
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | ToolMatchEvent
  | ToolStartEvent
  | ToolResultEvent
  | ToolErrorEvent
  | ToolConfirmEvent
  | PermissionDenialEvent
  | BudgetWarningEvent
  | BudgetExceededEvent
  | ContextCompactEvent
  | TurnStartEvent
  | TurnStopEvent
  | RoutingMatchEvent
  | ErrorEvent;

export function createStreamEvent(
  type: StreamEventType,
  data?: Record<string, unknown>,
  sessionId?: string,
  turnId?: number
): StreamEvent {
  return {
    type,
    timestamp: Date.now(),
    sessionId,
    turnId,
    data
  };
}

export function isTypedStreamEvent(event: StreamEvent): event is TypedStreamEvent {
  const typedEvents: StreamEventType[] = [
    'session_start',
    'message_start',
    'message_delta',
    'message_stop',
    'tool_match',
    'tool_start',
    'tool_result',
    'tool_error',
    'tool_confirm',
    'permission_denial',
    'budget_warning',
    'budget_exceeded',
    'context_compact',
    'turn_start',
    'turn_stop',
    'routing_match',
    'error'
  ];
  return typedEvents.includes(event.type);
}
