/**
 * Stream Events Panel
 * Shows real-time tool execution, budget status, and agent progress
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  XCircle,
  Shield,
  Zap,
  FileText,
  Terminal,
  Layers
} from 'lucide-react';
import type { ToolExecutionEvent, BudgetStatus, StreamSession } from '@/hooks/useStreamEvents';

interface StreamEventsPanelProps {
  className?: string;
  toolExecutions?: ToolExecutionEvent[];
  budgetStatus?: BudgetStatus | null;
  session?: StreamSession | null;
  currentPrompt?: string | null;
  compact?: boolean;
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  read_file: FileText,
  write_file: FileText,
  edit_file: FileText,
  list_dir: FileText,
  exec: Terminal,
  bash: Terminal,
  web_search: Zap,
  web_fetch: Zap,
  message: MessageCircle,
  sessions_send: Send,
  memory_search: Brain,
  memory_get: Brain,
  cron: Clock,
  gateway: Settings,
  spawn: Layers,
  default: Circle
};

function MessageCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function Send({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function Brain({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.24 3 3 0 0 0 .34 5.58 2.5 2.5 0 0 0 2.96 3.08A2.5 2.5 0 0 0 12 19.5a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 12 4.5" />
      <path d="M15.7 10.4c.1-.3.3-.6.5-.8.2-.2.4-.4.6-.5.3-.1.5-.1.7 0 .2.1.3.3.4.5.1.2.1.5 0 .7-.1.2-.3.4-.5.5-.2.1-.4.2-.6.2-.2 0-.5-.1-.7-.2-.1-.2-.3-.4-.4-.4z" />
      <path d="M8.3 13.6c.1-.3.3-.6.5-.8.2-.2.4-.4.6-.5.3-.1.5-.1.7 0 .2.1.3.3.4.5.1.2.1.5 0 .7-.1.2-.3.4-.5.5-.2.1-.4.2-.6.2-.2 0-.5-.1-.7-.2-.1-.2-.3-.4-.4-.4z" />
    </svg>
  );
}

function Settings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase();
  for (const [key, Icon] of Object.entries(TOOL_ICONS)) {
    if (name.includes(key)) {
      return Icon;
    }
  }
  return Circle;
}

function getStatusIcon(status: ToolExecutionEvent['status']) {
  switch (status) {
    case 'pending':
      return Circle;
    case 'running':
      return Clock;
    case 'success':
      return CheckCircle;
    case 'error':
      return XCircle;
    case 'denied':
      return Shield;
    default:
      return Circle;
  }
}

function getStatusColor(status: ToolExecutionEvent['status']): string {
  switch (status) {
    case 'pending':
      return 'text-gray-400';
    case 'running':
      return 'text-blue-500 animate-pulse';
    case 'success':
      return 'text-green-500';
    case 'error':
      return 'text-red-500';
    case 'denied':
      return 'text-amber-500';
    default:
      return 'text-gray-400';
  }
}

export function StreamEventsPanel({
  className,
  toolExecutions = [],
  budgetStatus,
  session,
  currentPrompt,
  compact = false
}: StreamEventsPanelProps) {
  const hasActivity = toolExecutions.length > 0 || budgetStatus || session;

  if (!hasActivity) {
    return null;
  }

  return (
    <div className={cn('bg-gray-50 rounded-lg border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-gray-700">Agent Activity</span>
        </div>
        {session && (
          <div className="text-xs text-gray-500">
            Turn {session.currentTurn}/{session.maxTurns}
          </div>
        )}
      </div>

      {/* Budget Bar */}
      {budgetStatus && (
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Token Budget</span>
            <span>{budgetStatus.percentageUsed}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                budgetStatus.percentageUsed >= 90
                  ? 'bg-red-500'
                  : budgetStatus.percentageUsed >= 75
                    ? 'bg-amber-500'
                    : 'bg-green-500'
              )}
              style={{ width: `${Math.min(100, budgetStatus.percentageUsed)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>{(budgetStatus.totalTokens / 1000).toFixed(1)}k tokens</span>
            <span>{(budgetStatus.maxTokens / 1000).toFixed(0)}k max</span>
          </div>
        </div>
      )}

      {/* Current Prompt */}
      {currentPrompt && !compact && (
        <div className="px-3 py-2 border-b border-gray-200 bg-blue-50">
          <div className="text-[10px] font-medium text-blue-600 mb-0.5">Prompt</div>
          <div className="text-xs text-gray-700 line-clamp-2">{currentPrompt}</div>
        </div>
      )}

      {/* Tool Executions */}
      {!compact && toolExecutions.length > 0 && (
        <div className="px-3 py-2 max-h-48 overflow-y-auto">
          <div className="text-[10px] font-medium text-gray-500 mb-1.5">
            Tools ({toolExecutions.length})
          </div>
          <div className="space-y-1.5">
            {toolExecutions.map((exec) => {
              const Icon = getToolIcon(exec.toolName);
              const StatusIcon = getStatusIcon(exec.status);
              const statusColor = getStatusColor(exec.status);

              return (
                <div
                  key={exec.id}
                  className="flex items-start gap-2 text-xs"
                >
                  <div className="mt-0.5">
                    <Icon className="h-3 w-3 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-gray-700 truncate">
                        {exec.toolName}
                      </span>
                      <StatusIcon className={cn('h-3 w-3 shrink-0', statusColor)} />
                    </div>
                    {exec.result && !compact && (
                      <div
                        className={cn(
                          'mt-0.5 text-[10px] font-mono rounded px-1.5 py-0.5 max-h-12 overflow-hidden',
                          exec.status === 'error' || exec.status === 'denied'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {exec.result.slice(0, 100)}
                        {exec.result.length > 100 ? '...' : ''}
                      </div>
                    )}
                    {exec.durationMs !== undefined && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {formatDuration(exec.durationMs)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Tool Summary */}
      {compact && toolExecutions.length > 0 && (
        <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto">
          {toolExecutions.map((exec) => {
            const Icon = getToolIcon(exec.toolName);
            const StatusIcon = getStatusIcon(exec.status);
            const statusColor = getStatusColor(exec.status);

            return (
              <div
                key={exec.id}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-xs shrink-0',
                  exec.status === 'running'
                    ? 'bg-blue-100 text-blue-700'
                    : exec.status === 'success'
                      ? 'bg-green-100 text-green-700'
                      : exec.status === 'error'
                        ? 'bg-red-100 text-red-700'
                        : exec.status === 'denied'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="font-mono">{exec.toolName.replace(/_/g, ' ')}</span>
                <StatusIcon className={cn('h-3 w-3', statusColor)} />
              </div>
            );
          })}
        </div>
      )}

      {/* Warning Banner */}
      {budgetStatus?.warningTriggered && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs text-amber-700">
            Budget at {budgetStatus.percentageUsed}% — agent may need to compact context
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline indicator for chat interface
 */
export function StreamIndicator({
  className,
  toolExecutions = [],
  budgetStatus
}: {
  className?: string;
  toolExecutions?: ToolExecutionEvent[];
  budgetStatus?: BudgetStatus | null;
}) {
  const running = toolExecutions.filter(t => t.status === 'running');
  const hasRunning = running.length > 0;

  if (!hasRunning && !budgetStatus?.warningTriggered) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-3 text-xs', className)}>
      {/* Running Tools */}
      {hasRunning && (
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-blue-500 animate-bounce"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
          <span className="text-gray-600">
            Running: {running.map(t => t.toolName.replace(/_/g, ' ')).join(', ')}
          </span>
        </div>
      )}

      {/* Budget Warning */}
      {budgetStatus?.warningTriggered && (
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-3 w-3" />
          <span>Budget: {budgetStatus.percentageUsed}%</span>
        </div>
      )}
    </div>
  );
}
