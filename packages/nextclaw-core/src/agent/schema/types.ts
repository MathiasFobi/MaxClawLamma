/**
 * Typed Module Registry System
 * Inspired by Claude Code's PortingModule pattern
 * 
 * Every tool/command is a typed module with:
 * - name: unique identifier
 * - description: what it does
 * - capabilities: what it can access
 * - permission_level: gate for execution
 * - schema: full JSON schema for the tool
 */

export type PermissionLevel = 
  | 'trusted'      // Full access, no restrictions
  | 'standard'     // Default level, basic operations
  | 'restricted'  // Limited, requires explicit enable
  | 'blocked';    // Cannot execute

export type Capability =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'filesystem:edit'
  | 'exec:bash'
  | 'exec:interactive'
  | 'network:http'
  | 'network:https'
  | 'message:send'
  | 'message:read'
  | 'session:read'
  | 'session:write'
  | 'session:spawn'
  | 'memory:read'
  | 'memory:write'
  | 'cron:read'
  | 'cron:write'
  | 'gateway:read'
  | 'gateway:write'
  | 'gateway:control'
  | 'subagent:control'
  | 'tool:execute';

export type ToolCategory =
  | 'filesystem'
  | 'exec'
  | 'web'
  | 'message'
  | 'session'
  | 'memory'
  | 'cron'
  | 'gateway'
  | 'subagent'
  | 'skill'
  | 'custom';

export interface ToolCapability {
  capability: Capability;
  description?: string;
}

export interface TypedToolModule {
  name: string;
  description: string;
  category: ToolCategory;
  capabilities: ToolCapability[];
  permissionLevel: PermissionLevel;
  parameters: Record<string, unknown>;
  source?: string;
  status: 'active' | 'deprecated' | 'experimental';
  version?: string;
  tags?: string[];
}

export interface PermissionContext {
  allow?: Capability[];
  block?: Capability[];
  requireConfirmation?: Capability[];
  sessionTrustLevel?: 'trusted' | 'standard' | 'restricted';
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

export interface RoutingMatch {
  module: TypedToolModule;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'intent';
  matchedTokens: string[];
}
