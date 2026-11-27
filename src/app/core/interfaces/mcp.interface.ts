/** App <-> pocketproject-mcp compatibility contract (Tauri `get_mcp_contract`). */
export interface McpContract {
  appVersion: string;
  protocolVersion: number;
  minMcpVersion: string;
  /** npm spec written into AI client configs, e.g. `pocketproject-mcp@2`. */
  packageSpec: string;
  /** Hash of the system prompt; changes whenever the prompt changes. */
  rulesVersion: string;
  /** The single AI system prompt. */
  rules: string;
}

export interface McpRuntime {
  mcpVersion: string;
  protocolVersion: number;
  rulesVersion?: string | null;
  startedAt?: number | null;
}

export interface McpConnectionStatus {
  runtime: McpRuntime;
  compatible: boolean;
  reason?: 'protocol_mismatch' | 'mcp_outdated' | null;
}

export interface McpClientStatus {
  client: string;
  path: string;
  configured: boolean;
  packageSpec?: string | null;
  upToDate: boolean;
}

export interface McpRulesStatus {
  path: string;
  present: boolean;
  upToDate: boolean;
}

export interface McpStatus {
  contract: McpContract;
  connection?: McpConnectionStatus | null;
  clients: McpClientStatus[];
  /** Every project rules file the app injected the AI rules into (kept up to date on app start). */
  rules: McpRulesStatus[];
}

export interface McpInstallResult {
  success: boolean;
  path: string;
  message: string;
}
