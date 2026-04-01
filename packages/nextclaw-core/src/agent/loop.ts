/**
 * AgentLoop Integration with:
 * - TypedToolRegistry: typed modules with permission levels
 * - StreamEmitter: real-time events for frontend
 * - BudgetManager: token/turn/cost limits
 */

import type { InboundMessage, OutboundMessage } from "../bus/events.js";
import type { MessageBus } from "../bus/queue.js";
import type { ProviderManager } from "../providers/provider_manager.js";
import { ContextBuilder } from "./context.js";
import { ToolRegistry } from "./tools/registry.js";
import { ReadFileTool, WriteFileTool, EditFileTool, ListDirTool } from "./tools/filesystem.js";
import { ExecTool } from "./tools/shell.js";
import { WebSearchTool, WebFetchTool } from "./tools/web.js";
import { MessageTool } from "./tools/message.js";
import { SpawnTool } from "./tools/spawn.js";
import { CronTool } from "./tools/cron.js";
import { SessionsListTool, SessionsHistoryTool, SessionsSendTool } from "./tools/sessions.js";
import { MemorySearchTool, MemoryGetTool } from "./tools/memory.js";
import { GatewayTool, type GatewayController } from "./tools/gateway.js";
import { SubagentsTool } from "./tools/subagents.js";
import { SubagentManager } from "./subagent.js";
import { SessionManager } from "../session/manager.js";
import type { CronService } from "../cron/service.js";
import type { Config } from "../config/schema.js";
import { evaluateSilentReply } from "./silent-reply-policy.js";
import { containsSilentReplyMarker } from "./tokens.js";
import { ExtensionToolAdapter } from "../extensions/tool-adapter.js";
import { createTypingStopControlMessage } from "../bus/control.js";
import type { ExtensionToolContext, ExtensionRegistry } from "../extensions/types.js";
import { InputBudgetPruner } from "./input-budget-pruner.js";

// NEW: Typed Module Registry
import { TypedToolRegistry, type PermissionContext, type RoutingMatch } from "./schema/index.js";

// NEW: Stream Events
import { StreamEmitter, MultiStreamEmitter, type StreamEvent } from "./events/index.js";

// NEW: Budget Management
import { BudgetManager, createBudgetConfig, type TokenBudgetConfig } from "./budget/index.js";

type MessageToolHintsResolver = (params: {
  sessionKey: string;
  channel: string;
  chatId: string;
  accountId?: string | null;
}) => string[];

export class AgentLoop {
  private context: ContextBuilder;
  private sessions: SessionManager;
  private tools: ToolRegistry;
  private subagents: SubagentManager;
  private inputBudgetPruner = new InputBudgetPruner();
  private running = false;
  private currentExtensionToolContext: ExtensionToolContext = {};
  private readonly agentId: string;

  // NEW: Typed Module Registry for permission/capability-based access
  private typedTools: TypedToolRegistry = new TypedToolRegistry();

  // NEW: Stream Events for real-time frontend updates
  private streams: MultiStreamEmitter = new MultiStreamEmitter();

  // NEW: Budget Manager for token/turn limits
  private budgets: BudgetManager = new BudgetManager();

  constructor(
    private options: {
      bus: MessageBus;
      providerManager: ProviderManager;
      workspace: string;
      model?: string | null;
      maxIterations?: number;
      maxTokens?: number;
      contextTokens?: number;
      braveApiKey?: string | null;
      execConfig?: { timeout: number };
      cronService?: CronService | null;
      restrictToWorkspace?: boolean;
      sessionManager?: SessionManager;
      contextConfig?: Config["agents"]["context"];
      gatewayController?: GatewayController;
      config?: Config;
      extensionRegistry?: ExtensionRegistry;
      resolveMessageToolHints?: MessageToolHintsResolver;
      agentId?: string;
      // NEW: Budget config
      budgetConfig?: Partial<TokenBudgetConfig>;
    }
  ) {
    this.context = new ContextBuilder(options.workspace, options.contextConfig);
    this.sessions = options.sessionManager ?? new SessionManager(options.workspace);
    this.tools = new ToolRegistry();
    this.subagents = new SubagentManager({
      providerManager: options.providerManager,
      workspace: options.workspace,
      bus: options.bus,
      model: options.model ?? options.providerManager.get().getDefaultModel(),
      maxTokens: options.maxTokens,
      contextTokens: options.contextTokens,
      braveApiKey: options.braveApiKey ?? undefined,
      execConfig: options.execConfig ?? { timeout: 60 },
      restrictToWorkspace: options.restrictToWorkspace ?? false
    });
    this.agentId = normalizeAgentId(options.agentId);

    // NEW: Initialize budget manager with config
    if (options.budgetConfig) {
      this.budgets = new BudgetManager(options.budgetConfig);
    }

    this.registerDefaultTools();
    this.registerExtensionTools();
  }

  // NEW: Get stream emitter for a session
  getStream(sessionKey: string): StreamEmitter | undefined {
    return this.streams.get(sessionKey);
  }

  // NEW: Create/get stream for session
  getOrCreateStream(sessionKey: string): StreamEmitter {
    let stream = this.streams.get(sessionKey);
    if (!stream) {
      stream = this.streams.create(sessionKey);
    }
    return stream;
  }

  // NEW: Get budget status for session
  getBudgetStatus(sessionKey: string) {
    return this.budgets.getStatus(sessionKey);
  }

  // NEW: Typed tool routing
  routeToolsByIntent(tokens: Set<string>, limit: number = 5): RoutingMatch[] {
    return this.typedTools.routeByIntent(tokens, limit);
  }

  // NEW: Get typed tool registry
  getTypedToolRegistry(): TypedToolRegistry {
    return this.typedTools;
  }

  private registerDefaultTools(): void {
    const allowedDir = this.options.restrictToWorkspace ? this.options.workspace : undefined;

    // Register tools with typed registry
    const readTool = new ReadFileTool(allowedDir);
    this.tools.register(readTool);
    this.typedTools.register(readTool, {
      category: 'filesystem',
      capabilities: [{ capability: 'filesystem:read' }],
      permissionLevel: 'standard'
    });

    const writeTool = new WriteFileTool(allowedDir);
    this.tools.register(writeTool);
    this.typedTools.register(writeTool, {
      category: 'filesystem',
      capabilities: [{ capability: 'filesystem:write' }],
      permissionLevel: 'standard'
    });

    const editTool = new EditFileTool(allowedDir);
    this.tools.register(editTool);
    this.typedTools.register(editTool, {
      category: 'filesystem',
      capabilities: [{ capability: 'filesystem:edit' }],
      permissionLevel: 'standard'
    });

    const listTool = new ListDirTool(allowedDir);
    this.tools.register(listTool);
    this.typedTools.register(listTool, {
      category: 'filesystem',
      capabilities: [{ capability: 'filesystem:read' }],
      permissionLevel: 'standard'
    });

    // Exec tool - restricted by default
    const execTool = new ExecTool({
      workingDir: this.options.workspace,
      timeout: this.options.execConfig?.timeout ?? 60,
      restrictToWorkspace: this.options.restrictToWorkspace ?? false
    });
    this.tools.register(execTool);
    this.typedTools.register(execTool, {
      category: 'exec',
      capabilities: [{ capability: 'exec:bash' }],
      permissionLevel: 'restricted',
      tags: ['dangerous', 'shell']
    });

    const webSearchTool = new WebSearchTool(this.options.braveApiKey ?? undefined);
    this.tools.register(webSearchTool);
    this.typedTools.register(webSearchTool, {
      category: 'web',
      capabilities: [{ capability: 'network:http' }],
      permissionLevel: 'standard'
    });

    const webFetchTool = new WebFetchTool();
    this.tools.register(webFetchTool);
    this.typedTools.register(webFetchTool, {
      category: 'web',
      capabilities: [{ capability: 'network:https' }],
      permissionLevel: 'standard'
    });

    const messageTool = new MessageTool((msg) => this.options.bus.publishOutbound(msg));
    this.tools.register(messageTool);
    this.typedTools.register(messageTool, {
      category: 'message',
      capabilities: [{ capability: 'message:send' }],
      permissionLevel: 'standard'
    });

    const spawnTool = new SpawnTool(this.subagents);
    this.tools.register(spawnTool);
    this.typedTools.register(spawnTool, {
      category: 'subagent',
      capabilities: [{ capability: 'session:spawn' }],
      permissionLevel: 'restricted'
    });

    this.tools.register(new SessionsListTool(this.sessions));
    this.tools.register(new SessionsHistoryTool(this.sessions));
    const sessionsSendTool = new SessionsSendTool(this.sessions, this.options.bus);
    this.tools.register(sessionsSendTool);
    this.typedTools.register(sessionsSendTool, {
      category: 'session',
      capabilities: [
        { capability: 'session:read' },
        { capability: 'session:write' }
      ],
      permissionLevel: 'standard'
    });

    const memorySearchTool = new MemorySearchTool(this.options.workspace);
    this.tools.register(memorySearchTool);
    this.typedTools.register(memorySearchTool, {
      category: 'memory',
      capabilities: [{ capability: 'memory:read' }],
      permissionLevel: 'standard'
    });

    const memoryGetTool = new MemoryGetTool(this.options.workspace);
    this.tools.register(memoryGetTool);
    this.typedTools.register(memoryGetTool, {
      category: 'memory',
      capabilities: [{ capability: 'memory:read' }],
      permissionLevel: 'standard'
    });

    const subagentsTool = new SubagentsTool(this.subagents);
    this.tools.register(subagentsTool);
    this.typedTools.register(subagentsTool, {
      category: 'subagent',
      capabilities: [{ capability: 'subagent:control' }],
      permissionLevel: 'restricted'
    });

    const gatewayTool = new GatewayTool(this.options.gatewayController);
    this.tools.register(gatewayTool);
    this.typedTools.register(gatewayTool, {
      category: 'gateway',
      capabilities: [
        { capability: 'gateway:read' },
        { capability: 'gateway:write' },
        { capability: 'gateway:control' }
      ],
      permissionLevel: 'restricted',
      tags: ['admin']
    });

    if (this.options.cronService) {
      const cronTool = new CronTool(this.options.cronService);
      this.tools.register(cronTool);
      this.typedTools.register(cronTool, {
        category: 'cron',
        capabilities: [
          { capability: 'cron:read' },
          { capability: 'cron:write' }
        ],
        permissionLevel: 'standard'
      });
    }
  }

  private registerExtensionTools(): void {
    const registry = this.options.extensionRegistry;
    if (!registry || registry.tools.length === 0 || !this.options.config) {
      return;
    }

    const seen = new Set<string>(this.tools.toolNames);
    for (const registration of registry.tools) {
      for (const alias of registration.names) {
        if (seen.has(alias)) {
          continue;
        }
        seen.add(alias);
        const adapted = new ExtensionToolAdapter({
          registration,
          alias,
          config: this.options.config,
          workspaceDir: this.options.workspace,
          contextProvider: () => this.currentExtensionToolContext,
          diagnostics: registry.diagnostics
        });
        this.tools.register(adapted);
        this.typedTools.register(adapted, {
          category: 'custom',
          capabilities: [{ capability: 'tool:execute' }],
          permissionLevel: 'standard',
          source: registration.source
        });
      }
    }
  }

  private setExtensionToolContext(params: { sessionKey: string; channel: string; chatId: string }): void {
    this.currentExtensionToolContext = {
      config: this.options.config,
      workspaceDir: this.options.workspace,
      sessionKey: params.sessionKey,
      channel: params.channel,
      chatId: params.chatId,
      sandboxed: this.options.restrictToWorkspace ?? false
    };
  }

  private setSessionsSendToolContext(params: {
    sessionKey: string;
    channel: string;
    chatId: string;
    handoffDepth: number;
  }): void {
    const sessionsSendTool = this.tools.get("sessions_send");
    if (!(sessionsSendTool instanceof SessionsSendTool)) {
      return;
    }
    sessionsSendTool.setContext({
      currentSessionKey: params.sessionKey,
      currentAgentId: this.agentId,
      channel: params.channel,
      chatId: params.chatId,
      maxPingPongTurns: this.options.config?.session?.agentToAgent?.maxPingPongTurns ?? 0,
      currentHandoffDepth: params.handoffDepth
    });
  }

  private resolveHandoffDepth(metadata: Record<string, unknown>): number {
    const rawDepth = Number(metadata.agent_handoff_depth ?? 0);
    if (!Number.isFinite(rawDepth) || rawDepth < 0) {
      return 0;
    }
    return Math.trunc(rawDepth);
  }

  async handleInbound(params: {
    message: InboundMessage;
    sessionKey?: string;
    publishResponse?: boolean;
  }): Promise<OutboundMessage | null> {
    const response = await this.processMessage(params.message, params.sessionKey);
    const shouldPublish = params.publishResponse ?? true;
    if (response && shouldPublish) {
      await this.options.bus.publishOutbound(response);
    }
    if (!response && shouldPublish && params.message.channel !== "system") {
      await this.options.bus.publishOutbound(createTypingStopControlMessage(params.message));
    }
    return response;
  }

  async run(): Promise<void> {
    this.running = true;
    while (this.running) {
      const msg = await this.options.bus.consumeInbound();
      try {
        await this.handleInbound({ message: msg });
      } catch (err) {
        await this.options.bus.publishOutbound({
          channel: msg.channel,
          chatId: msg.chatId,
          content: `Sorry, I encountered an error: ${String(err)}`,
          media: [],
          metadata: {}
        });
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  applyRuntimeConfig(config: Config): void {
    this.options.config = config;
    this.options.providerManager.setConfig(config);
    this.options.model = config.agents.defaults.model;
    this.options.maxIterations = config.agents.defaults.maxToolIterations;
    this.options.maxTokens = config.agents.defaults.maxTokens;
    this.options.contextTokens = config.agents.defaults.contextTokens;
    this.options.braveApiKey = config.tools.web.search.apiKey || undefined;
    this.options.execConfig = config.tools.exec;
    this.options.restrictToWorkspace = config.tools.restrictToWorkspace;

    this.context.setContextConfig(config.agents.context);
    this.subagents.updateRuntimeOptions({
      model: config.agents.defaults.model,
      maxTokens: config.agents.defaults.maxTokens,
      contextTokens: config.agents.defaults.contextTokens,
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      restrictToWorkspace: config.tools.restrictToWorkspace
    });
    this.refreshRuntimeTools();
  }

  private refreshRuntimeTools(): void {
    this.tools = new ToolRegistry();
    this.typedTools = new TypedToolRegistry();
    this.registerDefaultTools();
    this.registerExtensionTools();
  }

  async processDirect(params: {
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const msg: InboundMessage = {
      channel: params.channel ?? "cli",
      senderId: "user",
      chatId: params.chatId ?? "direct",
      content: params.content,
      timestamp: new Date(),
      attachments: [],
      metadata: params.metadata ?? {}
    };
    const response = await this.processMessage(msg, params.sessionKey);
    return response?.content ?? "";
  }

  private resolveSessionModel(session: { metadata: Record<string, unknown> }, metadata: Record<string, unknown>): string {
    const clearModel = metadata.clear_model === true || metadata.reset_model === true;
    if (clearModel) {
      delete session.metadata.preferred_model;
    }

    const inboundModel = this.readMetadataModel(metadata);
    if (inboundModel) {
      session.metadata.preferred_model = inboundModel;
    }

    const sessionModel =
      typeof session.metadata.preferred_model === "string" ? session.metadata.preferred_model.trim() : "";
    if (sessionModel) {
      return sessionModel;
    }

    return this.options.model ?? this.options.providerManager.get().getDefaultModel();
  }

  private readMetadataModel(metadata: Record<string, unknown>): string | null {
    const candidates = [metadata.model, metadata.llm_model, metadata.agent_model, metadata.session_model];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") {
        continue;
      }
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return null;
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private buildDeliveryContext(params: {
    channel: string;
    chatId: string;
    metadata: Record<string, unknown>;
    accountId?: string;
  }): Record<string, unknown> {
    const replyTo =
      this.normalizeOptionalString(params.metadata.reply_to) ??
      this.normalizeOptionalString(params.metadata.message_id);

    const deliveryMetadata: Record<string, unknown> = {};
    const slackMeta = params.metadata.slack;
    if (slackMeta && typeof slackMeta === "object" && !Array.isArray(slackMeta)) {
      const threadTs = this.normalizeOptionalString((slackMeta as Record<string, unknown>).thread_ts);
      const channelType = this.normalizeOptionalString((slackMeta as Record<string, unknown>).channel_type);
      if (threadTs || channelType) {
        deliveryMetadata.slack = {
          ...(threadTs ? { thread_ts: threadTs } : {}),
          ...(channelType ? { channel_type: channelType } : {})
        };
      }
    }

    const qqMeta = params.metadata.qq;
    if (qqMeta && typeof qqMeta === "object" && !Array.isArray(qqMeta)) {
      const msgId = this.normalizeOptionalString((qqMeta as Record<string, unknown>).msgId);
      const msgSeq = this.normalizeOptionalString((qqMeta as Record<string, unknown>).msgSeq);
      const groupId = this.normalizeOptionalString((qqMeta as Record<string, unknown>).groupId);
      const guildId = this.normalizeOptionalString((qqMeta as Record<string, unknown>).guildId);
      if (msgId || msgSeq || groupId || guildId) {
        deliveryMetadata.qq = {
          ...(msgId ? { msgId } : {}),
          ...(msgSeq ? { msgSeq } : {}),
          ...(groupId ? { groupId } : {}),
          ...(guildId ? { guildId } : {})
        };
      }
    }

    const groupId = this.normalizeOptionalString(params.metadata.group_id) ?? this.normalizeOptionalString(params.metadata.groupId);
    if (groupId) {
      deliveryMetadata.group_id = groupId;
    }

    const accountId =
      params.accountId ??
      this.normalizeOptionalString(params.metadata.accountId) ??
      this.normalizeOptionalString(params.metadata.account_id);
    if (accountId) {
      deliveryMetadata.accountId = accountId;
    }

    const context: Record<string, unknown> = {
      channel: params.channel,
      chatId: params.chatId,
      ...(replyTo ? { replyTo } : {}),
      ...(accountId ? { accountId } : {})
    };

    if (Object.keys(deliveryMetadata).length > 0) {
      context.metadata = deliveryMetadata;
    }

    return context;
  }

  private drainPendingSystemEvents(session: { metadata: Record<string, unknown> }): string[] {
    const key = "pending_system_events";
    const raw = session.metadata[key];
    if (!Array.isArray(raw)) {
      return [];
    }
    const events = raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    delete session.metadata[key];
    return events;
  }

  private prependSystemEvents(content: string, events: string[]): string {
    if (!events.length) {
      return content;
    }
    const block = events.map((event) => `[System Message] ${event}`).join("\n");
    return `${block}\n\n${content}`;
  }

  private pruneMessagesForInputBudget(messages: Array<Record<string, unknown>>): void {
    const result = this.inputBudgetPruner.prune({
      messages,
      contextTokens: this.options.contextTokens
    });
    messages.splice(0, messages.length, ...result.messages);
  }

  private async processMessage(msg: InboundMessage, sessionKeyOverride?: string): Promise<OutboundMessage | null> {
    if (msg.channel === "system") {
      return this.processSystemMessage(msg, sessionKeyOverride);
    }

    const sessionKey = sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;
    const session = this.sessions.getOrCreate(sessionKey);
    this.setExtensionToolContext({ sessionKey, channel: msg.channel, chatId: msg.chatId });
    this.setSessionsSendToolContext({
      sessionKey,
      channel: msg.channel,
      chatId: msg.chatId,
      handoffDepth: this.resolveHandoffDepth(msg.metadata)
    });

    // NEW: Initialize stream for this session
    const stream = this.getOrCreateStream(sessionKey);
    stream.sessionStart({
      sessionKey,
      channel: msg.channel,
      chatId: msg.chatId,
      model: this.options.model ?? 'default',
      toolsCount: this.tools.toolNames.length
    });

    const runtimeModel = this.resolveSessionModel(session, msg.metadata);
    const messageId = msg.metadata?.message_id as string | undefined;
    if (messageId) {
      session.metadata.last_message_id = messageId;
    }
    const sessionLabel = msg.metadata?.session_label as string | undefined;
    if (sessionLabel) {
      session.metadata.label = sessionLabel;
    }
    session.metadata.last_channel = msg.channel;
    session.metadata.last_to = msg.chatId;
    const inboundAccountId =
      (msg.metadata?.account_id as string | undefined) ??
      (msg.metadata?.accountId as string | undefined);
    const accountId =
      inboundAccountId && inboundAccountId.trim().length > 0
        ? inboundAccountId
        : typeof session.metadata.last_account_id === "string" && session.metadata.last_account_id.trim().length > 0
          ? (session.metadata.last_account_id as string)
          : undefined;
    if (accountId) {
      session.metadata.last_account_id = accountId;
    }
    session.metadata.last_delivery_context = this.buildDeliveryContext({
      channel: msg.channel,
      chatId: msg.chatId,
      metadata: msg.metadata,
      accountId
    });

    const pendingSystemEvents = this.drainPendingSystemEvents(session);
    const currentMessage = this.prependSystemEvents(msg.content, pendingSystemEvents);

    const messageTool = this.tools.get("message");
    if (messageTool instanceof MessageTool) {
      messageTool.setContext(msg.channel, msg.chatId);
    }
    const execTool = this.tools.get("exec");
    if (execTool instanceof ExecTool) {
      execTool.setContext({ sessionKey, channel: msg.channel, chatId: msg.chatId });
    }
    const spawnTool = this.tools.get("spawn");
    if (spawnTool instanceof SpawnTool) {
      spawnTool.setContext(msg.channel, msg.chatId);
    }
    const cronTool = this.tools.get("cron");
    if (cronTool instanceof CronTool) {
      cronTool.setContext(msg.channel, msg.chatId);
    }
    const gatewayTool = this.tools.get("gateway");
    if (gatewayTool instanceof GatewayTool) {
      gatewayTool.setContext({ sessionKey });
    }

    const messageToolHints = this.options.resolveMessageToolHints?.({
      sessionKey,
      channel: msg.channel,
      chatId: msg.chatId,
      accountId: accountId ?? null
    });

    const messages = this.context.buildMessages({
      history: this.sessions.getHistory(session),
      currentMessage,
      attachments: msg.attachments,
      channel: msg.channel,
      chatId: msg.chatId,
      sessionKey,
      messageToolHints
    });
    this.sessions.addMessage(session, "user", msg.content);

    // NEW: Emit message start event
    stream.messageStart(msg.content, messageId);

    let iteration = 0;
    let finalContent: string | null = null;
    let lastToolName: string | null = null;
    let lastToolResult: string | null = null;
    const maxIterations = this.options.maxIterations ?? 20;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    while (iteration < maxIterations) {
      iteration += 1;
      stream.turnStart(iteration, maxIterations);

      // NEW: Check budget before each turn
      const budgetCheck = this.budgets.checkBudget(sessionKey);
      if (!budgetCheck.allowed) {
        stream.budgetExceeded(
          budgetCheck.status.exceeded ? 'tokens' : 'turns',
          budgetCheck.status.totalTokens,
          budgetCheck.status.maxTokens,
          budgetCheck.stopReason || 'budget_exceeded'
        );
        finalContent = `Budget exceeded after ${iteration - 1} turns. ${budgetCheck.stopReason}`;
        break;
      }

      // NEW: Budget warning at 80%
      if (budgetCheck.status.warningTriggered && iteration === 1) {
        stream.budgetWarning(
          'tokens',
          budgetCheck.status.totalTokens,
          budgetCheck.status.maxTokens
        );
      }

      this.pruneMessagesForInputBudget(messages);
      
      const response = await this.options.providerManager.chat({
        messages,
        tools: this.tools.getDefinitions(),
        model: runtimeModel,
        maxTokens: this.options.maxTokens
      });

      // Track token usage (rough estimate)
      const inputEstimate = JSON.stringify(messages).length / 4;
      const outputEstimate = (response.content?.length || 0) / 4;
      totalInputTokens += inputEstimate;
      totalOutputTokens += outputEstimate;

      if (containsSilentReplyMarker(response.content)) {
        this.sessions.addMessage(session, "assistant", response.content ?? "");
        this.sessions.save(session);
        stream.messageStop({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens }, 'silent_reply');
        return null;
      }

      if (response.toolCalls.length) {
        // NEW: Emit tool match event
        const toolNames = response.toolCalls.map(c => c.name);
        stream.toolMatch(toolNames);

        const toolCallDicts = response.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: JSON.stringify(call.arguments)
          }
        }));
        this.context.addAssistantMessage(messages, response.content, toolCallDicts, response.reasoningContent ?? null);
        this.sessions.addMessage(session, "assistant", response.content ?? "", {
          tool_calls: toolCallDicts,
          reasoning_content: response.reasoningContent ?? null
        });

        for (const call of response.toolCalls) {
          // NEW: Emit tool start event
          stream.toolStart(call.name, call.id, call.arguments);

          // Check permission via typed registry
          const canExecute = this.typedTools.canExecute(call.name);
          if (!canExecute) {
            const module = this.typedTools.getModule(call.name);
            const reason = `Tool requires higher permission level`;
            stream.permissionDenial(call.name, reason, module?.permissionLevel || 'unknown');
            lastToolResult = `PermissionDenied: ${reason}`;
            this.context.addToolResult(messages, call.id, call.name, lastToolResult);
            this.sessions.addMessage(session, "tool", lastToolResult, {
              tool_call_id: call.id,
              name: call.name
            });
            continue;
          }

          const startTime = Date.now();
          const result = await this.tools.execute(call.name, call.arguments, call.id);
          lastToolName = call.name;
          lastToolResult = result;

          // NEW: Emit tool result event
          const isError = result.startsWith('Error:') || result.startsWith('PermissionDenied:');
          stream.toolResult(call.name, call.id, !isError, isError ? undefined : result, isError ? result : undefined, startTime);

          this.context.addToolResult(messages, call.id, call.name, result);
          this.sessions.addMessage(session, "tool", result, {
            tool_call_id: call.id,
            name: call.name
          });

          // NEW: Check if compact is needed
          if (this.budgets.shouldCompact(sessionKey)) {
            const prevTokens = this.budgets.getStatus(sessionKey).totalTokens;
            this.budgets.compact(sessionKey);
            stream.contextCompact(prevTokens, prevTokens / 2, 6);
          }
        }
      } else {
        finalContent = response.content;
        // NEW: Emit message delta (final)
        stream.messageDelta(response.content || '', false);
        break;
      }
    }

    // NEW: Update budget with final usage
    if (sessionKey) {
      this.budgets.updateUsage(sessionKey, totalInputTokens, totalOutputTokens);
    }

    if (typeof finalContent !== "string") {
      finalContent = buildToolLoopFallback({
        maxIterations,
        lastToolName,
        lastToolResult
      });
    }

    const { content: cleanedContent, replyTo } = parseReplyTags(finalContent, messageId);
    finalContent = cleanedContent;
    const finalReplyDecision = evaluateSilentReply({
      content: finalContent,
      media: []
    });
    if (finalReplyDecision.shouldDrop) {
      this.sessions.save(session);
      stream.messageStop({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens }, 'silent_reply');
      return null;
    }
    finalContent = finalReplyDecision.content;

    this.sessions.addMessage(session, "assistant", finalContent);
    this.sessions.save(session);

    // NEW: Emit message stop
    stream.messageStop(
      { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      finalContent ? 'completed' : 'no_content'
    );

    return {
      channel: msg.channel,
      chatId: msg.chatId,
      content: finalContent,
      replyTo,
      media: [],
      metadata: msg.metadata ?? {}
    };
  }

  private async processSystemMessage(
    msg: InboundMessage,
    sessionKeyOverride?: string
  ): Promise<OutboundMessage | null> {
    const separator = msg.chatId.indexOf(":");
    const originChannel = separator > 0 ? msg.chatId.slice(0, separator) : "cli";
    const originChatId = separator > 0 ? msg.chatId.slice(separator + 1) : msg.chatId;

    const sessionKey = sessionKeyOverride ?? `${originChannel}:${originChatId}`;
    const session = this.sessions.getOrCreate(sessionKey);
    this.setExtensionToolContext({ sessionKey, channel: originChannel, chatId: originChatId });
    this.setSessionsSendToolContext({
      sessionKey,
      channel: originChannel,
      chatId: originChatId,
      handoffDepth: this.resolveHandoffDepth(msg.metadata)
    });
    const runtimeModel = this.resolveSessionModel(session, msg.metadata);

    const messageTool = this.tools.get("message");
    if (messageTool instanceof MessageTool) {
      messageTool.setContext(originChannel, originChatId);
    }
    const execTool = this.tools.get("exec");
    if (execTool instanceof ExecTool) {
      execTool.setContext({ sessionKey, channel: originChannel, chatId: originChatId });
    }
    const spawnTool = this.tools.get("spawn");
    if (spawnTool instanceof SpawnTool) {
      spawnTool.setContext(originChannel, originChatId);
    }
    const cronTool = this.tools.get("cron");
    if (cronTool instanceof CronTool) {
      cronTool.setContext(originChannel, originChatId);
    }
    const gatewayTool = this.tools.get("gateway");
    if (gatewayTool instanceof GatewayTool) {
      gatewayTool.setContext({ sessionKey });
    }

    const accountId =
      (msg.metadata?.account_id as string | undefined) ??
      (msg.metadata?.accountId as string | undefined) ??
      (typeof session.metadata.last_account_id === "string" ? (session.metadata.last_account_id as string) : undefined);
    if (accountId) {
      session.metadata.last_account_id = accountId;
    }

    const messageToolHints = this.options.resolveMessageToolHints?.({
      sessionKey,
      channel: originChannel,
      chatId: originChatId,
      accountId: accountId ?? null
    });

    const messages = this.context.buildMessages({
      history: this.sessions.getHistory(session),
      currentMessage: msg.content,
      channel: originChannel,
      chatId: originChatId,
      sessionKey,
      messageToolHints
    });
    this.sessions.addMessage(session, "user", `[System: ${msg.senderId}] ${msg.content}`);

    let iteration = 0;
    let finalContent: string | null = null;
    let lastToolName: string | null = null;
    let lastToolResult: string | null = null;
    const maxIterations = this.options.maxIterations ?? 20;

    while (iteration < maxIterations) {
      iteration += 1;
      this.pruneMessagesForInputBudget(messages);
      const response = await this.options.providerManager.chat({
        messages,
        tools: this.tools.getDefinitions(),
        model: runtimeModel,
        maxTokens: this.options.maxTokens
      });

      if (containsSilentReplyMarker(response.content)) {
        this.sessions.addMessage(session, "assistant", response.content ?? "");
        this.sessions.save(session);
        return null;
      }

      if (response.toolCalls.length) {
        const toolCallDicts = response.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: JSON.stringify(call.arguments)
          }
        }));
        this.context.addAssistantMessage(messages, response.content, toolCallDicts, response.reasoningContent ?? null);
        this.sessions.addMessage(session, "assistant", response.content ?? "", {
          tool_calls: toolCallDicts,
          reasoning_content: response.reasoningContent ?? null
        });
        for (const call of response.toolCalls) {
          const result = await this.tools.execute(call.name, call.arguments, call.id);
          lastToolName = call.name;
          lastToolResult = result;
          this.context.addToolResult(messages, call.id, call.name, result);
          this.sessions.addMessage(session, "tool", result, {
            tool_call_id: call.id,
            name: call.name
          });
        }
      } else {
        finalContent = response.content;
        break;
      }
    }

    if (typeof finalContent !== "string") {
      finalContent = buildToolLoopFallback({
        maxIterations,
        lastToolName,
        lastToolResult
      });
    }
    const { content: cleanedContent, replyTo } = parseReplyTags(finalContent, undefined);
    finalContent = cleanedContent;
    const finalReplyDecision = evaluateSilentReply({
      content: finalContent,
      media: []
    });
    if (finalReplyDecision.shouldDrop) {
      this.sessions.save(session);
      return null;
    }
    finalContent = finalReplyDecision.content;

    this.sessions.addMessage(session, "assistant", finalContent);
    this.sessions.save(session);

    return {
      channel: originChannel,
      chatId: originChatId,
      content: finalContent,
      replyTo,
      media: [],
      metadata: msg.metadata ?? {}
    };
  }
}

function parseReplyTags(
  content: string,
  currentMessageId?: string
): { content: string; replyTo?: string } {
  let replyTo: string | undefined;
  const replyCurrent = /\[\[\s*reply_to_current\s*\]\]/gi;
  if (replyCurrent.test(content)) {
    replyTo = currentMessageId;
    content = content.replace(replyCurrent, "").trim();
  }
  const replyId = /\[\[\s*reply_to\s*:\s*([^\]]+?)\s*\]\]/i;
  const match = content.match(replyId);
  if (match && match[1]) {
    replyTo = match[1].trim();
    content = content.replace(replyId, "").trim();
  }
  return { content, replyTo };
}

function normalizeAgentId(value: string | undefined): string {
  const text = (value ?? "").trim().toLowerCase();
  return text || "main";
}

function buildToolLoopFallback(params: {
  maxIterations: number;
  lastToolName: string | null;
  lastToolResult: string | null;
}): string {
  const { maxIterations, lastToolName, lastToolResult } = params;
  const base = `Sorry, tool calls did not converge after ${maxIterations} iterations. Please retry or rephrase.`;

  const toolLabel = lastToolName?.trim();
  const rawResult = lastToolResult?.trim() ?? "";
  if (!toolLabel && !rawResult) {
    return base;
  }

  const snippet = rawResult
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 2)
    .join(" ");
  const clipped = snippet.length > 180 ? `${snippet.slice(0, 180)}...` : snippet;
  const isError = clipped.startsWith("Error:");

  const detailParts: string[] = [];
  if (toolLabel) {
    detailParts.push(`Last tool: ${toolLabel}`);
  }
  if (clipped) {
    detailParts.push(`${isError ? "Last error" : "Last result"}: ${clipped}`);
  }

  return detailParts.length ? `${base} ${detailParts.join(". ")}` : base;
}
