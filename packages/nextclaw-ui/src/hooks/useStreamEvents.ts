/**
 * Stream Events Hook
 * Connects to the agent's real-time event stream via WebSocket
 */

import { useEffect, useRef, useState, useCallback } from 'react';

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

export interface ToolExecutionEvent {
  id: string;
  toolName: string;
  toolCallId: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'denied';
  result?: string;
  error?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

export interface StreamSession {
  sessionKey: string;
  channel: string;
  chatId: string;
  model: string;
  toolsCount: number;
  startedAt: number;
  currentTurn: number;
  maxTurns: number;
}

export interface BudgetStatus {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  maxTokens: number;
  turns: number;
  maxTurns: number;
  percentageUsed: number;
  warningTriggered: boolean;
}

export interface UseStreamEventsOptions {
  sessionKey?: string;
  enabled?: boolean;
  onEvent?: (event: StreamEvent) => void;
  onToolMatch?: (tools: string[]) => void;
  onToolResult?: (toolName: string, result: string, success: boolean) => void;
  onBudgetWarning?: (current: number, limit: number) => void;
}

export function useStreamEvents(options: UseStreamEventsOptions = {}) {
  const { sessionKey, enabled = true, onEvent, onToolMatch, onToolResult, onBudgetWarning } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [toolExecutions, setToolExecutions] = useState<Map<string, ToolExecutionEvent>>(new Map());
  const [currentSession, setCurrentSession] = useState<StreamSession | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState<string | null>(null);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ inputTokens: number; outputTokens: number } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    const wsUrl = getWebSocketUrl();
    const ws = new WebSocket(wsUrl);

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setIsConnected(true);
      
      // Subscribe to session events if we have a session key
      if (sessionKey) {
        ws.send(JSON.stringify({ type: 'subscribe', sessionKey }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StreamEvent;
        handleEvent(data);
      } catch (err) {
        console.error('Failed to parse stream event:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('Stream WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [enabled, sessionKey]);

  const handleEvent = useCallback((event: StreamEvent) => {
    // Add to events list
    setEvents(prev => [...prev.slice(-99), event]);

    // Call external handler
    onEvent?.(event);

    // Handle specific event types
    switch (event.type) {
      case 'session_start':
        if (event.data) {
          setCurrentSession({
            sessionKey: event.data.sessionKey as string,
            channel: event.data.channel as string,
            chatId: event.data.chatId as string,
            model: event.data.model as string,
            toolsCount: event.data.toolsCount as number,
            startedAt: event.timestamp,
            currentTurn: 0,
            maxTurns: 20
          });
          setToolExecutions(new Map());
          setBudgetStatus(null);
          setCurrentPrompt(null);
          setMessageContent(null);
          setStopReason(null);
          setUsage(null);
        }
        break;

      case 'message_start':
        if (event.data) {
          setCurrentPrompt(event.data.prompt as string);
          setMessageContent(null);
          setStopReason(null);
        }
        break;

      case 'tool_match':
        if (event.data?.tools) {
          onToolMatch?.(event.data.tools as string[]);
        }
        break;

      case 'tool_start':
        if (event.data) {
          const exec: ToolExecutionEvent = {
            id: `tool-${event.data.toolCallId}`,
            toolName: event.data.toolName as string,
            toolCallId: event.data.toolCallId as string,
            status: 'running',
            startTime: event.timestamp
          };
          setToolExecutions(prev => {
            const next = new Map(prev);
            next.set(exec.id, exec);
            return next;
          });
        }
        break;

      case 'tool_result':
        if (event.data) {
          const data = event.data;
          const id = `tool-${data.toolCallId}`;
          const success = data.success as boolean;
          setToolExecutions(prev => {
            const next = new Map(prev);
            const existing = next.get(id);
            if (existing) {
              const updated: ToolExecutionEvent = {
                ...existing,
                status: success ? 'success' : 'error',
                result: data.result as string | undefined,
                error: data.error as string | undefined,
                endTime: event.timestamp,
                durationMs: data.durationMs as number | undefined
              };
              next.set(id, updated);
              
              // Call external handler
              if (updated.result !== undefined) {
                onToolResult?.(updated.toolName, updated.result, success);
              }
            }
            return next;
          });
        }
        break;

      case 'tool_error':
        if (event.data) {
          const toolName = event.data.toolName as string;
          const error = event.data.error as string;
          // Find and update the most recent tool with this name
          setToolExecutions(prev => {
            const next = new Map(prev);
            for (const [id, exec] of next) {
              if (exec.toolName === toolName && exec.status === 'running') {
                next.set(id, {
                  ...exec,
                  status: 'error',
                  error,
                  endTime: event.timestamp
                });
                break;
              }
            }
            return next;
          });
        }
        break;

      case 'permission_denial':
        if (event.data) {
          const toolName = event.data.toolName as string;
          const reason = event.data.reason as string;
          setToolExecutions(prev => {
            const next = new Map(prev);
            for (const [id, exec] of next) {
              if (exec.toolName === toolName && exec.status === 'running') {
                next.set(id, {
                  ...exec,
                  status: 'denied',
                  error: reason,
                  endTime: event.timestamp
                });
                break;
              }
            }
            return next;
          });
        }
        break;

      case 'turn_start':
        if (event.data) {
          const turn = event.data.turnNumber as number;
          const maxTurns = event.data.maxTurns as number;
          setCurrentSession(prev => prev ? {
            ...prev,
            currentTurn: turn,
            maxTurns
          } : null);
        }
        break;

      case 'message_delta':
        if (event.data) {
          const content = event.data.content as string;
          const isPartial = event.data.delta as boolean;
          if (isPartial) {
            setMessageContent(prev => (prev || '') + content);
          } else {
            setMessageContent(content);
          }
        }
        break;

      case 'message_stop':
        if (event.data) {
          setStopReason(event.data.stopReason as string);
          setUsage({
            inputTokens: (event.data.usage as { inputTokens: number }).inputTokens,
            outputTokens: (event.data.usage as { outputTokens: number }).outputTokens
          });
        }
        break;

      case 'budget_warning':
        if (event.data) {
          const current = event.data.current as number;
          const limit = event.data.limit as number;
          const percentage = event.data.percentage as number;
          setBudgetStatus(prev => prev ? {
            ...prev,
            warningTriggered: true
          } : {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: current,
            maxTokens: limit,
            turns: 0,
            maxTurns: 20,
            percentageUsed: percentage,
            warningTriggered: true
          });
          onBudgetWarning?.(current, limit);
        }
        break;

      case 'budget_exceeded':
        if (event.data) {
          setBudgetStatus(prev => prev ? {
            ...prev,
            percentageUsed: 100
          } : null);
        }
        break;

      case 'context_compact':
        if (event.data) {
          const previousTokens = event.data.previousTokens as number;
          const newTokens = event.data.newTokens as number;
          setBudgetStatus(prev => prev ? {
            ...prev,
            totalTokens: newTokens,
            percentageUsed: Math.round((newTokens / prev.maxTokens) * 100)
          } : null);
        }
        break;
    }
  }, [onEvent, onToolMatch, onToolResult, onBudgetWarning]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const clearToolExecutions = useCallback(() => {
    setToolExecutions(new Map());
  }, []);

  return {
    isConnected,
    events,
    toolExecutions: Array.from(toolExecutions.values()),
    currentSession,
    budgetStatus,
    currentPrompt,
    messageContent,
    stopReason,
    usage,
    clearEvents,
    clearToolExecutions,
    disconnect,
    reconnect: connect
  };
}

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/stream`;
}
