/**
 * Typed Tool Registry
 * Extends ToolRegistry with typed modules, permission levels, and capability-based routing
 */

import type {
  TypedToolModule,
  PermissionLevel,
  Capability,
  PermissionContext,
  RoutingMatch,
  SchemaValidationResult,
  ToolCategory,
  ToolCapability
} from './types.js';
import { ToolRegistry } from '../tools/registry.js';
import { Tool, type ToolSchema } from '../tools/base.js';

const DEFAULT_PERMISSION_CONTEXT: PermissionContext = {
  allow: [],
  block: [],
  requireConfirmation: [],
  sessionTrustLevel: 'standard'
};

export class TypedToolRegistry {
  private modules: Map<string, TypedToolModule> = new Map();
  private tools: ToolRegistry = new ToolRegistry();
  private permissionContext: PermissionContext = DEFAULT_PERMISSION_CONTEXT;

  register(tool: Tool, options?: Partial<TypedToolModule>): void {
    const name = tool.name;
    
    const module: TypedToolModule = {
      name,
      description: tool.description || options?.description || `Tool: ${name}`,
      category: options?.category || this.inferCategory(name),
      capabilities: options?.capabilities || this.inferCapabilities(name),
      permissionLevel: options?.permissionLevel || this.inferPermissionLevel(name),
      parameters: tool.parameters || options?.parameters || { type: 'object', properties: {} },
      source: options?.source,
      status: options?.status || 'active',
      version: options?.version,
      tags: options?.tags || []
    };

    this.modules.set(name, module);
    this.tools.register(tool);
  }

  unregister(name: string): void {
    this.modules.delete(name);
    this.tools.unregister(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getModule(name: string): TypedToolModule | undefined {
    return this.modules.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getDefinitions(): Array<Record<string, unknown>> {
    return this.tools.getDefinitions();
  }

  getModules(): TypedToolModule[] {
    return Array.from(this.modules.values());
  }

  getModulesByCategory(category: ToolCategory): TypedToolModule[] {
    return this.getModules().filter(m => m.category === category);
  }

  getModulesByCapability(capability: Capability): TypedToolModule[] {
    return this.getModules().filter(m => 
      m.capabilities.some(c => c.capability === capability)
    );
  }

  setPermissionContext(context: PermissionContext): void {
    this.permissionContext = {
      ...DEFAULT_PERMISSION_CONTEXT,
      ...context
    };
  }

  getPermissionContext(): PermissionContext {
    return { ...this.permissionContext };
  }

  canExecute(toolName: string, trustLevel?: 'trusted' | 'standard' | 'restricted'): boolean {
    const module = this.modules.get(toolName);
    if (!module) return false;

    const effectiveTrust = trustLevel || this.permissionContext.sessionTrustLevel || 'standard';
    
    const permissionHierarchy: Record<PermissionLevel, number> = {
      blocked: 0,
      restricted: 1,
      standard: 2,
      trusted: 3
    };

    const effectiveLevel = module.permissionLevel;
    const requiredLevel = effectiveLevel;

    return permissionHierarchy[effectiveTrust] >= permissionHierarchy[requiredLevel];
  }

  filterByPermission(modules: TypedToolModule[], trustLevel?: 'trusted' | 'standard' | 'restricted'): TypedToolModule[] {
    return modules.filter(m => this.canExecute(m.name, trustLevel));
  }

  getBlockedTools(): TypedToolModule[] {
    return this.getModules().filter(m => m.permissionLevel === 'blocked');
  }

  getRestrictedTools(): TypedToolModule[] {
    return this.getModules().filter(m => m.permissionLevel === 'restricted');
  }

  async execute(name: string, params: Record<string, unknown>, toolCallId?: string): Promise<string> {
    if (!this.canExecute(name)) {
      const module = this.modules.get(name);
      const reason = module 
        ? `Tool '${name}' requires '${module.permissionLevel}' permission, current session is '${this.permissionContext.sessionTrustLevel}'`
        : `Tool '${name}' not found`;
      return `PermissionDenied: ${reason}`;
    }

    const requiresConfirmation = this.requiresConfirmation(name);
    if (requiresConfirmation) {
      return `ConfirmationRequired: Tool '${name}' requires user confirmation before execution`;
    }

    return this.tools.execute(name, params, toolCallId);
  }

  requiresConfirmation(toolName: string): boolean {
    const module = this.modules.get(toolName);
    if (!module) return false;

    return module.capabilities.some(c => 
      this.permissionContext.requireConfirmation?.includes(c.capability)
    );
  }

  validateParams(name: string, params: Record<string, unknown>): SchemaValidationResult {
    const tool = this.tools.get(name);
    if (!tool) {
      return { valid: false, errors: [`Tool '${name}' not found`] };
    }

    try {
      const errors = tool.validateParams(params);
      return { valid: errors.length === 0, errors };
    } catch (err) {
      return { valid: false, errors: [String(err)] };
    }
  }

  routeByIntent(tokens: Set<string>, limit: number = 10): RoutingMatch[] {
    const matches: RoutingMatch[] = [];

    for (const module of this.modules.values()) {
      const score = this.scoreModule(tokens, module);
      if (score > 0) {
        const matchedTokens = this.getMatchedTokens(tokens, module);
        matches.push({
          module,
          score,
          matchType: this.determineMatchType(score, module),
          matchedTokens
        });
      }
    }

    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.matchType !== b.matchType) {
        const typeOrder = { exact: 0, fuzzy: 1, intent: 2 };
        return typeOrder[a.matchType] - typeOrder[b.matchType];
      }
      return a.module.name.localeCompare(b.module.name);
    });

    return matches.slice(0, limit);
  }

  search(query: string, limit: number = 20): TypedToolModule[] {
    const queryLower = query.toLowerCase();
    const queryTokens = Array.from(new Set(queryLower.split(/\s+/).filter(Boolean)));

    const matches = this.getModules()
      .filter(m => {
        const searchable = [
          m.name.toLowerCase(),
          m.description.toLowerCase(),
          ...(m.tags || []).map(t => t.toLowerCase()),
          m.category.toLowerCase()
        ].join(' ');
        return queryTokens.every((token: string) => searchable.includes(token));
      })
      .slice(0, limit);

    return matches;
  }

  toSchema(): Record<string, unknown> {
    return {
      modules: this.getModules().map(m => ({
        name: m.name,
        description: m.description,
        category: m.category,
        capabilities: m.capabilities,
        permissionLevel: m.permissionLevel,
        status: m.status,
        version: m.version,
        tags: m.tags
      })),
      total: this.modules.size,
      blockedCount: this.getBlockedTools().length,
      restrictedCount: this.getRestrictedTools().length
    };
  }

  private inferCategory(name: string): ToolCategory {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('file') || nameLower.includes('dir') || nameLower.includes('read') || nameLower.includes('write') || nameLower.includes('edit')) {
      return 'filesystem';
    }
    if (nameLower.includes('exec') || nameLower.includes('shell') || nameLower.includes('bash') || nameLower.includes('spawn')) {
      return 'exec';
    }
    if (nameLower.includes('web') || nameLower.includes('search') || nameLower.includes('fetch')) {
      return 'web';
    }
    if (nameLower.includes('message') || nameLower.includes('send') || nameLower.includes('telegram') || nameLower.includes('discord')) {
      return 'message';
    }
    if (nameLower.includes('session')) {
      return 'session';
    }
    if (nameLower.includes('memory') || nameLower.includes('remember')) {
      return 'memory';
    }
    if (nameLower.includes('cron') || nameLower.includes('schedule')) {
      return 'cron';
    }
    if (nameLower.includes('gateway') || nameLower.includes('config')) {
      return 'gateway';
    }
    if (nameLower.includes('subagent') || nameLower.includes('spawn')) {
      return 'subagent';
    }
    
    return 'custom';
  }

  private inferCapabilities(name: string): ToolCapability[] {
    const caps: ToolCapability[] = [];
    const nameLower = name.toLowerCase();

    if (nameLower.includes('read') || nameLower.includes('file') || nameLower.includes('dir') || nameLower.includes('list')) {
      caps.push({ capability: 'filesystem:read' });
    }
    if (nameLower.includes('write') || nameLower.includes('file') || nameLower.includes('create')) {
      caps.push({ capability: 'filesystem:write' });
    }
    if (nameLower.includes('edit') || nameLower.includes('modify')) {
      caps.push({ capability: 'filesystem:edit' });
    }
    if (nameLower.includes('exec') || nameLower.includes('shell') || nameLower.includes('bash')) {
      caps.push({ capability: 'exec:bash' });
    }
    if (nameLower.includes('send') || nameLower.includes('message')) {
      caps.push({ capability: 'message:send' });
    }
    if (nameLower.includes('session') || nameLower.includes('history')) {
      caps.push({ capability: 'session:read' });
    }
    if (nameLower.includes('memory') || nameLower.includes('remember')) {
      caps.push({ capability: 'memory:read' });
      caps.push({ capability: 'memory:write' });
    }
    if (nameLower.includes('cron') || nameLower.includes('schedule')) {
      caps.push({ capability: 'cron:read' });
      caps.push({ capability: 'cron:write' });
    }
    if (nameLower.includes('gateway') || nameLower.includes('config')) {
      caps.push({ capability: 'gateway:read' });
      caps.push({ capability: 'gateway:write' });
    }
    if (nameLower.includes('spawn') || nameLower.includes('subagent')) {
      caps.push({ capability: 'session:spawn' });
    }

    return caps.length ? caps : [{ capability: 'tool:execute', description: 'Generic tool execution' }];
  }

  private inferPermissionLevel(name: string): PermissionLevel {
    const nameLower = name.toLowerCase();

    if (nameLower === 'gateway' || nameLower.includes('gateway')) {
      return 'restricted';
    }
    if (nameLower.includes('exec') || nameLower.includes('shell') || nameLower.includes('bash')) {
      return 'restricted';
    }
    if (nameLower.includes('spawn') || nameLower.includes('subagent')) {
      return 'restricted';
    }
    if (nameLower.includes('write') || nameLower.includes('delete') || nameLower.includes('remove')) {
      return 'standard';
    }

    return 'standard';
  }

  private scoreModule(tokens: Set<string>, module: TypedToolModule): number {
    let score = 0;
    const moduleTokens = new Set([
      module.name.toLowerCase(),
      module.description.toLowerCase(),
      module.category.toLowerCase(),
      ...(module.tags || []).map(t => t.toLowerCase())
    ].flatMap(text => text.split(/\s+/)));

    for (const token of tokens) {
      if (module.name.toLowerCase().includes(token) || module.name.toLowerCase() === token) {
        score += 10;
      }
      if (moduleTokens.has(token)) {
        score += 5;
      }
      if (module.description.toLowerCase().includes(token)) {
        score += 2;
      }
      if (module.category.toLowerCase() === token) {
        score += 3;
      }
    }

    return score;
  }

  private getMatchedTokens(tokens: Set<string>, module: TypedToolModule): string[] {
    const matched: string[] = [];
    const haystack = new Set([
      module.name.toLowerCase(),
      module.description.toLowerCase(),
      ...(module.tags || []).map(t => t.toLowerCase())
    ]);

    for (const token of tokens) {
      if (haystack.has(token) || Array.from(haystack).some(h => h.includes(token))) {
        matched.push(token);
      }
    }

    return matched;
  }

  private determineMatchType(score: number, module: TypedToolModule): 'exact' | 'fuzzy' | 'intent' {
    if (score >= 10) return 'exact';
    if (score >= 5) return 'fuzzy';
    return 'intent';
  }
}
