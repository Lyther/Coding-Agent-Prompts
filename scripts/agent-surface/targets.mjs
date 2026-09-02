// The heart of the compiler: the per-target adapter table + the producers that turn source
// (commands/rules/subagents/skills/mcp) into per-target outputs. Imports render/roots/merge/
// postprocess; the install + check layers import targets/targetOutputs/producers from here.
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { directDirectories, filesUnder } from "./fs-tree.mjs";
import { optionalServiceMcpServers, renderMcpConfig } from "./merge.mjs";
import { normalizeExternalSkillFile } from "./postprocess.mjs";
import { readOptionalServices, relative, root } from "./registry.mjs";
import { firstHeading, renderAntigravityCliRuleDocument, renderAntigravityCliSubagent, renderAntigravityWorkflow, renderClaudeSubagent, renderClineSubagent, renderClineWorkflow, renderCodexSubagent, renderCopilotSubagent, renderCursorCommand, renderCursorSubagent, renderDeepAgentsSubagent, renderDroidCommand, renderDroidSubagent, renderGooseRecipe, renderInstructionDocument, renderKiloRuleDocument, renderKiloSubagent, renderKiloWorkflow, renderKimiCodeSubagent, renderKiroManualSteering, renderKiroRuleDocument, renderKiroSubagent, renderManualClaudeSkill, renderManualKimiCodeSkill, renderManualPortableSkill, renderNativeMarkdownCommand, renderOpenCodeCommand, renderOpenCodeSubagent, renderQwenCodeCommand, renderQwenCodeSubagent, renderScopedRuleReferenceDocument, renderTraeSubagent, renderVanillaSkill, renderVsCodeInstructionDocument, renderVsCodePromptDocument, renderWindsurfWorkflow } from "./render.mjs";
import { antigravitySkillRoot, antigravityWorkflowRoot, claudeMcpPath, clineAgentRoot, clineCursorExtensionMcpPath, clineMcpPath, clineRuleRoot, clineSkillRoot, clineVsCodeExtensionMcpPath, clineWindsurfExtensionMcpPath, clineWorkflowRoot, codexSkillOutputName, copilotAgentRoot, copilotInstructionPath, copilotMcpPath, copilotSkillRoot, cursorSkillRoot, deepagentsAgentRoot, deepagentsConfigRoot, deepagentsInstructionPath, deepagentsMcpPath, deepagentsSkillRoot, deepagentsSubagentOutputName, droidConfigRoot, droidInstructionPath, droidSkillRoot, dshSkillRoot, flatMarkdownCommandOutputName, gooseRecipeOutputName, gooseSkillRoot, grokBuildSkillRoot, installRootAntigravity, installRootAntigravityCli, installRootCodex, installRootHomeOnly, installRootKimiCode, installRootUserOrProject, installRootVsCode, kiloAgentRoot, kiloConfigPath, kiloRuleReferenceRoot, kiloRuleRoot, kiloSkillRoot, kiloWorkflowRoot, kimiCodeAgentRoot, kimiCodeConfigPath, kimiCodeConfigRoot, kimiCodeCursorSettingsPath, kimiCodeInstructionPath, kimiCodeMcpPath, kimiCodeSkillRoot, kimiCodeVsCodeSettingsPath, kiroAgentRoot, kiroMcpPath, kiroPermissionsPath, kiroSkillRoot, kiroSteeringRoot, opencodeAgentRoot, opencodeCommandRoot, opencodeConfigRoot, opencodeInstructionPath, opencodeMcpPath, opencodeSkillRoot, openhandsConfigRoot, openhandsInstructionPath, openhandsMcpPath, openhandsSkillRoot, piConfigRoot, piInstructionPath, piSkillRoot, poolConfigRoot, poolInstructionPath, poolSkillRoot, qoderAgentRoot, qoderCommandRoot, qoderConfigRoot, qoderInstructionPath, qoderSettingsPath, qoderSkillRoot, qwenCodeAgentRoot, qwenCodeCommandRoot, qwenCodeConfigRoot, qwenCodeInstructionPath, qwenCodeSettingsPath, qwenCodeSkillRoot, sharedAgentSkillRoot, traeAgentRoot, traeCliConfigPath, traeCliSkillRoot, traeRuleRoot, traeSkillRoot, vsCodeUserRoot, windsurfConfigRoot, windsurfMcpPath, windsurfRulePath, windsurfSkillRoot, windsurfWorkflowRoot, zedConfigRoot, zedInstructionPath, zedMcpPath, zedSkillRoot } from "./roots.mjs";
import { readRules } from "./rules.mjs";
import { ignoreOutputs, subagentOutputs } from "./source-primitives.mjs";
import { exists, fail, isSafeRelativePath } from "./util.mjs";

export const targets = {
  "claude-code": {
    label: "Claude Code skills and subagents",
    commandRenders: ["skills"],
    subagentRenders: ["subagents"],
    subagentTarget: "claude-code",
    subagentOutputRoot: ".claude/agents",
    externalSkillOutputRoot: ".claude/skills",
    skillRenders: ["skills"],
    skillOutputRoot: ".claude/skills",
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: ".claude/skills",
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualClaudeSkill,
    renderSubagent: renderClaudeSubagent,
    installRoot: installRootUserOrProject,
    mcpConfig: {
      relativeOutput: claudeMcpPath,
      format: "mcpServers",
      defaultEnabled: true,
    },
  },
  codex: {
    label: "Codex skills, custom agents, and global instructions",
    commandRenders: ["skills"],
    subagentRenders: ["subagents"],
    subagentTarget: "codex",
    subagentOutputRoot: path.join(".codex", "agents"),
    subagentOutputExtension: ".toml",
    externalSkillOutputRoot: path.join(".agents", "skills"),
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: ".agents/skills",
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    additionalSkillOutputs: [codexOpenAiAgentOutput],
    commandOutputRoot: sharedAgentSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    additionalCommandOutputs: [codexManualOpenAiAgentOutput],
    renderSubagent: renderCodexSubagent,
    installRoot: installRootCodex,
    staticOutputs: codexStaticOutputs,
    mcpConfig: {
      relativeOutput: () => path.join(".codex", "config.toml"),
      format: "codex-toml",
      defaultEnabled: true,
      rootProperties: {
        approval_policy: "never",
        sandbox_mode: "danger-full-access",
      },
    },
  },
  deepagents: {
    label: "Deep Agents Code skills, instructions, subagents, and MCP",
    commandRenders: ["skills"],
    subagentRenders: ["subagents"],
    subagentTarget: "deepagents",
    subagentOutputRoot: deepagentsAgentRoot,
    subagentOutputName: deepagentsSubagentOutputName,
    externalSkillOutputRoot: deepagentsSkillRoot,
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: deepagentsSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: deepagentsSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    renderSubagent: renderDeepAgentsSubagent,
    installRoot: installRootUserOrProject,
    staticOutputs: deepagentsStaticOutputs,
    mcpConfig: {
      relativeOutput: deepagentsMcpPath,
      format: "mcpServers",
      defaultEnabled: true,
    },
  },
  goose: {
    label: "Goose reusable recipes and MCP",
    commandRenders: ["recipes", "skills"],
    skillRenders: ["skills"],
    skillOutputRoot: gooseSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: (context) => context.scope === "user" ? gooseSkillRoot(context) : "recipes",
    commandOutputName: (source, context) => context.scope === "user" ? codexSkillOutputName(source) : gooseRecipeOutputName(source),
    renderCommand: (source, context) => context.scope === "user" ? renderManualPortableSkill(source, context) : renderGooseRecipe(source),
    installRoot: installRootUserOrProject,
    mcpConfig: {
      // Goose MCP lives in the user-global config.yaml (`extensions:`), so it is user-scope
      // only. Project commands remain recipes; user commands use Agent Skills.
      relativeOutput: () => path.join(".config", "goose", "config.yaml"),
      format: "goose-extensions",
      defaultEnabled: true,
      scopes: ["user"],
    },
  },
  "grok-build": {
    label: "Grok Build skills and project instructions",
    commandRenders: ["skills"],
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: grokBuildSkillRoot,
    skillOutputName: codexSkillOutputName,
    externalSkillOutputRoot: grokBuildSkillRoot,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: grokBuildSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    installRoot: installRootUserOrProject,
    staticOutputs: grokBuildStaticOutputs,
    mcpConfig: {
      relativeOutput: () => path.join(".grok", "config.toml"),
      format: "codex-toml",
      defaultEnabled: true,
      rootProperties: (context) => context.scope === "user"
        ? { ui: { permission_mode: "always-approve" } }
        : {},
    },
    cleanupConfigRoutes: [{
      relativeOutput: () => path.join(".grok", "settings.json"),
      format: "mcpServers",
    }],
  },
  dsh: {
    label: "DSH Agent Skills",
    skillRenders: ["skills"],
    skillOutputRoot: dshSkillRoot,
    skillOutputName: codexSkillOutputName,
    externalSkillOutputRoot: dshSkillRoot,
    renderSkill: renderVanillaSkill,
    installRoot: installRootUserOrProject,
  },
  pi: {
    label: "Pi skills and instructions",
    commandRenders: ["skills"],
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: piSkillRoot,
    skillOutputName: codexSkillOutputName,
    externalSkillOutputRoot: piSkillRoot,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: piSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    installRoot: installRootUserOrProject,
    staticOutputs: piStaticOutputs,
  },
  pool: {
    label: "Poolside skills and instructions",
    commandRenders: ["skills"],
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: poolSkillRoot,
    skillOutputName: codexSkillOutputName,
    externalSkillOutputRoot: poolSkillRoot,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: poolSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    installRoot: installRootUserOrProject,
    staticOutputs: poolStaticOutputs,
    mcpConfig: {
      relativeOutput: (context) => context.scope === "user"
        ? path.join(".config", "poolside", "settings.yaml")
        : path.join(".poolside", "settings.yaml"),
      format: "poolside-mcp",
      defaultEnabled: true,
    },
  },
  cline: {
    label: "Cline workflows, rules, skills, configured agents, and MCP",
    commandRenders: ["commands-as-workflows"],
    subagentRenders: ["subagents"],
    subagentTarget: "cline",
    subagentOutputRoot: clineAgentRoot,
    subagentOutputExtension: ".yaml",
    externalSkillOutputRoot: clineSkillRoot,
    skillRenders: ["skills"],
    skillOutputRoot: clineSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    staticRenders: ["rules"],
    commandOutputRoot: clineWorkflowRoot,
    renderCommand: renderClineWorkflow,
    renderSubagent: renderClineSubagent,
    installRoot: installRootUserOrProject,
    ignoreFilename: ".clineignore",
    staticOutputs: clineStaticOutputs,
    mcpConfigs: [
      {
        relativeOutput: clineMcpPath,
        format: "mcpServers",
        defaultEnabled: true,
        scopes: ["user"],
      },
      {
        relativeOutput: clineVsCodeExtensionMcpPath,
        format: "mcpServers",
        defaultEnabled: true,
        scopes: ["user"],
        emitOutput: false,
        allowAbsoluteOutput: true,
      },
      {
        relativeOutput: clineCursorExtensionMcpPath,
        format: "mcpServers",
        defaultEnabled: true,
        scopes: ["user"],
        emitOutput: false,
        allowAbsoluteOutput: true,
      },
      {
        relativeOutput: clineWindsurfExtensionMcpPath,
        format: "mcpServers",
        defaultEnabled: true,
        scopes: ["user"],
        emitOutput: false,
        allowAbsoluteOutput: true,
      },
    ],
    cleanupConfigRoutes: [{
      relativeOutput: () => path.join(".cline", "mcp.json"),
      format: "mcpServers",
    }],
  },
  kilo: {
    label: "Kilo workflows, instructions, and subagents",
    commandRenders: ["commands-as-workflows"],
    subagentRenders: ["subagents"],
    subagentTarget: "kilo",
    subagentOutputRoot: kiloAgentRoot,
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: kiloSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: kiloWorkflowRoot,
    renderCommand: renderKiloWorkflow,
    renderSubagent: renderKiloSubagent,
    installRoot: installRootUserOrProject,
    ignoreFilename: ".kilocodeignore",
    staticOutputs: kiloStaticOutputs,
    mcpConfig: {
      relativeOutput: kiloConfigPath,
      format: "local-command-map",
      defaultEnabled: true,
      emitOutput: false,
      rootProperties: {
        permission: { "*": "allow" },
        share: "disabled",
      },
    },
  },
  "kimi-code": {
    label: "Kimi Code skills, instructions, custom agents, and MCP",
    commandRenders: ["skills"],
    subagentRenders: ["subagents"],
    subagentTarget: "kimi-code",
    subagentOutputRoot: kimiCodeAgentRoot,
    externalSkillOutputRoot: kimiCodeSkillRoot,
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: kimiCodeSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: kimiCodeSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualKimiCodeSkill,
    renderSubagent: renderKimiCodeSubagent,
    installRoot: installRootKimiCode,
    staticOutputs: kimiCodeStaticOutputs,
    mcpConfigs: [
      {
        relativeOutput: kimiCodeConfigPath,
        format: "codex-toml",
        defaultEnabled: false,
        includeServices: false,
        rootProperties: {
          default_permission_mode: "auto",
          merge_all_available_skills: true,
        },
      },
      {
        relativeOutput: kimiCodeMcpPath,
        format: "kimi-mcp",
        defaultEnabled: true,
      },
      {
        relativeOutput: kimiCodeVsCodeSettingsPath,
        format: "json-settings",
        defaultEnabled: false,
        includeServices: false,
        emitOutput: false,
        allowAbsoluteOutput: true,
        scopes: ["user"],
        rootProperties: {
          "kimi.yoloMode": true,
        },
      },
      {
        relativeOutput: kimiCodeCursorSettingsPath,
        format: "json-settings",
        defaultEnabled: false,
        includeServices: false,
        emitOutput: false,
        allowAbsoluteOutput: true,
        scopes: ["user"],
        rootProperties: {
          "kimi.yoloMode": true,
        },
      },
    ],
  },
  qoder: {
    label: "Qoder skills, commands, instructions, subagents, and MCP",
    commandRenders: ["commands"],
    subagentRenders: ["subagents"],
    subagentTarget: "qoder",
    subagentOutputRoot: qoderAgentRoot,
    externalSkillOutputRoot: qoderSkillRoot,
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: qoderSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: qoderCommandRoot,
    commandOutputName: flatMarkdownCommandOutputName,
    renderCommand: renderNativeMarkdownCommand,
    renderSubagent: renderClaudeSubagent,
    installRoot: installRootUserOrProject,
    staticOutputs: qoderStaticOutputs,
    mcpConfig: {
      relativeOutput: qoderSettingsPath,
      format: "kimi-mcp",
      defaultEnabled: true,
      rootProperties: {
        general: { defaultPermissionMode: "bypass_permissions" },
        skills: { loadFromAgentsDirectory: false },
      },
    },
  },
  "qwen-code": {
    label: "Qwen Code skills, commands, instructions, subagents, and MCP",
    commandRenders: ["commands"],
    subagentRenders: ["subagents"],
    subagentTarget: "qwen-code",
    subagentOutputRoot: qwenCodeAgentRoot,
    externalSkillOutputRoot: qwenCodeSkillRoot,
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: qwenCodeSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: qwenCodeCommandRoot,
    commandOutputName: flatMarkdownCommandOutputName,
    renderCommand: renderQwenCodeCommand,
    renderSubagent: renderQwenCodeSubagent,
    installRoot: installRootUserOrProject,
    staticOutputs: qwenCodeStaticOutputs,
    mcpConfig: {
      relativeOutput: qwenCodeSettingsPath,
      format: "kimi-mcp",
      defaultEnabled: true,
      rootProperties: {
        tools: { approvalMode: "yolo" },
      },
    },
  },
  kiro: {
    label: "Kiro skills, steering, subagents, permissions, and MCP",
    commandRenders: ["commands-as-workflows"],
    subagentRenders: ["subagents"],
    subagentTarget: "kiro",
    subagentOutputRoot: kiroAgentRoot,
    externalSkillOutputRoot: kiroSkillRoot,
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: kiroSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: kiroSteeringRoot,
    commandOutputName: (source) => `command-${source.name}.md`,
    renderCommand: renderKiroManualSteering,
    renderSubagent: renderKiroSubagent,
    installRoot: installRootUserOrProject,
    staticOutputs: kiroStaticOutputs,
    mcpConfigs: [
      {
        relativeOutput: kiroMcpPath,
        format: "kimi-mcp",
        defaultEnabled: true,
      },
      {
        relativeOutput: kiroPermissionsPath,
        format: "kiro-permissions",
        defaultEnabled: false,
        includeServices: false,
        scopes: ["user"],
        rootProperties: {
          rules: [{ capability: "all", effect: "allow" }],
        },
      },
    ],
  },
  antigravity: {
    label: "Antigravity skills and manual workflows",
    commandRenders: ["commands-as-workflows"],
    skillRenders: ["skills"],
    skillOutputRoot: antigravitySkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: antigravityWorkflowRoot,
    renderCommand: renderAntigravityWorkflow,
    installRoot: installRootAntigravity,
  },
  "antigravity-cli": {
    label: "Antigravity CLI plugin",
    commandRenders: ["skills"],
    subagentRenders: ["subagents"],
    subagentTarget: "antigravity-cli",
    subagentOutputRoot: path.join("antigravity-cli", "plugins", "agent-surface", "agents"),
    externalSkillOutputRoot: path.join("antigravity-cli", "plugins", "agent-surface", "skills"),
    staticRenders: ["plugins", "rules"],
    skillRenders: ["skills"],
    skillOutputRoot: path.join("antigravity-cli", "plugins", "agent-surface", "skills"),
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: path.join("antigravity-cli", "plugins", "agent-surface", "skills"),
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    renderSubagent: renderAntigravityCliSubagent,
    installRoot: installRootAntigravityCli,
    staticOutputs: antigravityCliStaticOutputs,
    mcpConfig: {
      relativeOutput: () => path.join("antigravity-cli", "plugins", "agent-surface", "mcp_config.json"),
      format: "mcpServers",
      defaultEnabled: true,
    },
    // The former direct-import route is trusted only while an old manifest owns it.
    // It is never emitted, so a later runtime-owned import remains untouched.
    cleanupConfigRoutes: [{
      relativeOutput: () => path.join("config", "plugins", "agent-surface", "mcp_config.json"),
      format: "mcpServers",
    }],
  },
  cursor: {
    label: "Cursor global commands, rules, and subagents",
    commandRenders: ["commands"],
    subagentRenders: ["subagents"],
    subagentTarget: "cursor",
    subagentOutputRoot: ".cursor/agents",
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: cursorSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: ".cursor/commands",
    renderCommand: renderCursorCommand,
    renderSubagent: renderCursorSubagent,
    installRoot: installRootHomeOnly,
    ignoreFilename: ".cursorignore",
    staticOutputs: cursorStaticOutputs,
    mcpConfig: {
      relativeOutput: () => path.join(".cursor", "mcp.json"),
      format: "mcpServers",
      defaultEnabled: true,
    },
  },
  droid: {
    label: "Factory Droid commands, instructions, droids, and optional external assets",
    commandRenders: ["commands"],
    subagentRenders: ["subagents"],
    subagentTarget: "droid",
    subagentOutputRoot: path.join(".factory", "droids"),
    externalSkillOutputRoot: path.join(".factory", "skills"),
    skillRenders: ["skills"],
    skillOutputRoot: droidSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    staticRenders: ["rules"],
    commandOutputRoot: path.join(".factory", "commands"),
    renderCommand: renderDroidCommand,
    renderSubagent: renderDroidSubagent,
    installRoot: installRootUserOrProject,
    staticOutputs: droidStaticOutputs,
    mcpConfig: {
      relativeOutput: () => path.join(".factory", "mcp.json"),
      format: "mcpServers",
      defaultEnabled: true,
    },
  },
  copilot: {
    label: "GitHub Copilot CLI skills, instructions, custom agents, and MCP",
    commandRenders: ["skills"],
    subagentRenders: ["subagents"],
    subagentTarget: "copilot",
    subagentOutputRoot: copilotAgentRoot,
    subagentOutputName: (source) => `${source.metadata.name}.agent.md`,
    skillRenders: ["skills"],
    skillOutputRoot: copilotSkillRoot,
    skillOutputName: codexSkillOutputName,
    externalSkillOutputRoot: copilotSkillRoot,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: copilotSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    renderSubagent: renderCopilotSubagent,
    staticRenders: ["instructions"],
    installRoot: installRootUserOrProject,
    staticOutputs: copilotStaticOutputs,
    mcpConfig: {
      relativeOutput: copilotMcpPath,
      format: "mcpServers",
      defaultEnabled: true,
    },
  },
  vscode: {
    label: "VS Code user prompt and instruction files",
    skillRenders: ["skills"],
    skillOutputRoot: sharedAgentSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    commandRenders: ["prompts"],
    commandOutputRoot: (context) => path.join(vsCodeUserRoot("Code", context), "prompts"),
    commandOutputName: flatMarkdownCommandOutputName,
    renderCommand: renderVsCodePromptDocument,
    staticRenders: ["instructions", "prompts"],
    installRoot: installRootVsCode,
    staticOutputs: vscodeStaticOutputs,
    mcpConfig: {
      relativeOutput: (context) => path.join(vsCodeUserRoot("Code", context), "mcp.json"),
      format: "vscode-servers",
      defaultEnabled: true,
    },
  },
  opencode: {
    label: "OpenCode commands, agents, and global instructions",
    commandRenders: ["commands"],
    subagentRenders: ["subagents"],
    subagentTarget: "opencode",
    subagentOutputRoot: opencodeAgentRoot,
    commandOutputRoot: opencodeCommandRoot,
    skillRenders: ["skills"],
    skillOutputRoot: opencodeSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    renderCommand: renderOpenCodeCommand,
    renderSubagent: renderOpenCodeSubagent,
    staticRenders: ["rules"],
    installRoot: installRootUserOrProject,
    staticOutputs: opencodeStaticOutputs,
    mcpConfig: {
      relativeOutput: opencodeMcpPath,
      format: "local-command-map",
      defaultEnabled: true,
      rootProperties: {
        permission: { "*": "allow" },
        share: "disabled",
      },
      replaceRootProperties: ["permission"],
    },
  },
  openhands: {
    label: "OpenHands AgentSkills, instructions, and MCP",
    commandRenders: ["skills"],
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: openhandsSkillRoot,
    skillOutputName: codexSkillOutputName,
    externalSkillOutputRoot: openhandsSkillRoot,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: openhandsSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    installRoot: installRootUserOrProject,
    staticOutputs: openhandsStaticOutputs,
    mcpConfig: {
      relativeOutput: openhandsMcpPath,
      format: "mcpServers",
      defaultEnabled: true,
      scopes: ["user"],
    },
  },
  trae: {
    label: "Trae skills, rules, subagents, CLI policy, and MCP",
    commandRenders: ["skills"],
    subagentRenders: ["subagents"],
    subagentTarget: "trae",
    subagentOutputRoot: traeAgentRoot,
    skillRenders: ["skills"],
    skillOutputRoot: traeSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    additionalSkillOutputs: [traeCliSkillOutput],
    commandOutputRoot: traeSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    additionalCommandOutputs: [traeCliCommandOutput],
    renderSubagent: renderTraeSubagent,
    staticRenders: ["rules"],
    installRoot: installRootHomeOnly,
    staticOutputs: traeStaticOutputs,
    mcpConfigs: [
      {
        relativeOutput: () => path.join(".trae", "mcp.json"),
        format: "mcpServers",
        defaultEnabled: true,
      },
      {
        relativeOutput: traeCliConfigPath,
        format: "codex-toml",
        defaultEnabled: true,
        scopes: ["user"],
        rootProperties: {
          approval_policy: "never",
          default_permissions: ":danger-full-access",
        },
      },
    ],
  },
  windsurf: {
    label: "Windsurf workflows, rules, and skills",
    commandRenders: ["commands-as-workflows"],
    staticRenders: ["rules"],
    commandOutputRoot: windsurfWorkflowRoot,
    commandOutputName: flatMarkdownCommandOutputName,
    skillRenders: ["skills"],
    skillOutputRoot: windsurfSkillRoot,
    skillOutputName: codexSkillOutputName,
    renderSkill: renderVanillaSkill,
    externalSkillOutputRoot: windsurfSkillRoot,
    renderCommand: renderWindsurfWorkflow,
    installRoot: installRootUserOrProject,
    staticOutputs: windsurfStaticOutputs,
    mcpConfig: {
      relativeOutput: windsurfMcpPath,
      format: "mcpServers",
      defaultEnabled: true,
    },
  },
  zed: {
    label: "Zed skills and instructions",
    commandRenders: ["skills"],
    staticRenders: ["rules"],
    skillRenders: ["skills"],
    skillOutputRoot: zedSkillRoot,
    skillOutputName: codexSkillOutputName,
    externalSkillOutputRoot: zedSkillRoot,
    renderSkill: renderVanillaSkill,
    commandOutputRoot: zedSkillRoot,
    commandOutputName: codexSkillOutputName,
    renderCommand: renderManualPortableSkill,
    installRoot: installRootUserOrProject,
    staticOutputs: zedStaticOutputs,
    mcpConfig: {
      relativeOutput: zedMcpPath,
      format: "zed-context-servers",
      defaultEnabled: true,
    },
  },
};

// Full user-scope installs run these cleanup-only adapters before active targets.
// They are not build targets and cannot be selected directly.
export const retiredInstallTargets = {
  "gemini-cli": {
    label: "retired Gemini CLI cleanup",
    installRoot: installRootHomeOnly,
    cleanupConfigRoutes: [{
      relativeOutput: () => path.join(".gemini", "settings.json"),
      format: "mcpServers",
    }],
  },
  vscodium: {
    label: "retired VSCodium cleanup",
    installRoot: installRootHomeOnly,
    mcpConfig: {
      relativeOutput: (context) => path.join(vsCodeUserRoot("VSCodium", context), "mcp.json"),
      format: "vscode-servers",
      defaultEnabled: false,
      scopes: [],
    },
  },
};

export const generatedOutputMinimums = new Map([
  ["claude-code", 250],
  ["codex", 300],
  ["deepagents", 250],
  ["goose", 50],
  ["grok-build", 250],
  ["dsh", 250],
  ["pi", 250],
  ["pool", 250],
  ["cline", 50],
  ["kilo", 60],
  ["kimi-code", 250],
  ["qoder", 250],
  ["qwen-code", 250],
  ["kiro", 250],
  ["antigravity", 50],
  ["antigravity-cli", 250],
  ["cursor", 60],
  ["droid", 250],
  ["copilot", 250],
  ["vscode", 1],
  ["opencode", 55],
  ["openhands", 250],
  ["trae", 1],
  ["windsurf", 250],
  ["zed", 250],
]);

export const MAX_EXTERNAL_FILE_BYTES = 1_000_000;

export const MAX_EXTERNAL_TOTAL_BYTES = 200_000_000;

export const MAX_EXTERNAL_FILES = 50_000;

export function targetProducers(adapter) {
  const producers = [];
  if (adapter.renderSkill || (adapter.additionalSkillOutputs?.length ?? 0) > 0) {
    producers.push({ id: "skills", sourceKind: "skills", emits: adapter.skillRenders ?? ["skills"], produce: (catalog, context) => produceSkillOutputs(adapter, catalog.skills, context) });
  }
  if (adapter.renderCommand || (adapter.additionalCommandOutputs?.length ?? 0) > 0) {
    producers.push({ id: "commands", sourceKind: "commands", emits: adapter.commandRenders ?? ["commands"], produce: (catalog, context) => produceCommandOutputs(adapter, catalog.commands, context) });
  }
  if (adapter.staticOutputs) {
    producers.push({ id: "static", sourceKind: "rules", emits: adapter.staticRenders ?? [], produce: (catalog, context) => adapter.staticOutputs(catalog, context) });
  }
  if (adapter.externalSkillOutputRoot || adapter.skillOutputRoot) {
    producers.push({ id: "external-skills", sourceKind: "external", emits: ["external"], produce: (_commands, context) => externalSkillOutputs(adapter, context) });
  }
  if (adapter.subagentOutputRoot && adapter.renderSubagent) {
    producers.push({ id: "subagents", sourceKind: "subagents", emits: adapter.subagentRenders ?? ["subagents"], produce: (commands, context) => subagentOutputs(adapter, context) });
  }
  if (adapter.ignoreFilename) {
    producers.push({ id: "ignores", sourceKind: "ignores", emits: ["ignores"], produce: () => ignoreOutputs(adapter) });
  }
  if (adapterMcpConfigs(adapter).length > 0) {
    producers.push({ id: "mcps", sourceKind: "external", emits: ["mcps"], produce: (_commands, context) => optionalMcpOutputs(adapter, context) });
  }
  return producers;
}
export async function targetOutputs(adapter, catalog, context) {
  const outputs = [];

  for (const producer of targetProducers(adapter)) {
    const produced = await producer.produce(catalog, context);
    outputs.push(...produced.map((output) => ({
      ...output,
      producerId: producer.id,
      sourceKind: output.sourceKind ?? producer.sourceKind,
      renderKind: output.renderKind ?? producerDefaultRenderKind(producer),
    })));
  }

  const seen = new Map();
  for (const output of outputs) {
    if (!isSafeRelativePath(output.relativeOutput)) fail(`unsafe generated output path: ${output.relativeOutput}`);
    const previous = seen.get(output.relativeOutput);
    if (previous) {
      fail(
        `duplicate generated output path: ${output.relativeOutput} (${previous.producerId}:${previous.source} and ${output.producerId}:${output.source})`,
      );
    }
    seen.set(output.relativeOutput, output);
  }

  return outputs.sort((left, right) => left.relativeOutput.localeCompare(right.relativeOutput));
}

export function producerEmitsFor(adapter) {
  const emits = new Set();
  for (const producer of targetProducers(adapter)) {
    for (const token of producer.emits ?? []) emits.add(token);
  }
  return emits;
}

export function producerDefaultRenderKind(producer) {
  return producer.emits?.length === 1 ? producer.emits[0] : producer.id;
}

export async function produceCommandOutputs(adapter, commands, context) {
  // Some adapters restrict where their command artifacts may be installed. Build
  // (dist inspection) is never gated; only live install writes are.
  if (adapter.commandInstallScopes && context.mode === "install" && !adapter.commandInstallScopes.includes(context.scope)) {
    return [];
  }
  const outputs = [];
  for (const command of commands) {
    if (adapter.renderCommand) {
      outputs.push({
        source: command.relativePath,
        relativeOutput: commandRelativeOutput(adapter, command, context),
        content: await adapter.renderCommand(command, context),
      });
    }

    for (const buildOutput of adapter.additionalCommandOutputs ?? []) {
      outputs.push(await buildOutput(command, context));
    }
  }
  return outputs;
}

export async function produceSkillOutputs(adapter, skills, context) {
  const outputs = [];
  for (const skill of skills) {
    if (adapter.renderSkill) {
      outputs.push({
        source: skill.relativePath,
        relativeOutput: skillRelativeOutput(adapter, skill, context),
        content: await adapter.renderSkill(skill, context),
      });
    }
    for (const buildOutput of adapter.additionalSkillOutputs ?? []) {
      outputs.push(await buildOutput(skill, context));
    }
  }
  return outputs;
}

export async function externalSkillOutputs(adapter, context) {
  const externalOutputRoot = adapter.externalSkillOutputRoot ?? adapter.skillOutputRoot;
  if (!externalOutputRoot) return [];
  // External assets are part of the default distribution: a full install (no category
  // filter) generates them so strict-sync keeps in-scope packs and prunes de-scoped ones.
  // Only skip when an explicit category filter excludes "external".
  if (context.mode === "install" && context.categoryFilter && !context.categoryFilter.has("external")) return [];
  const outputs = [];
  const roots = await externalSkillRoots();
  const outputRoot = outputRootFor(externalOutputRoot, context);
  const textExtensions = [".md", ".mdx", ".json", ".yaml", ".yml", ".toml", ".txt", ".sh", ".py", ".js", ".ts", ".ps1"];

  let totalBytes = 0;
  for (const { root: sourceRoot, serviceName } of roots) {
    const skillName = path.basename(sourceRoot);
    const skillFiles = await filesUnder(sourceRoot, textExtensions);
    for (const file of skillFiles) {
      if (outputs.length >= MAX_EXTERNAL_FILES) {
        const detail = `external skill output cap reached (${MAX_EXTERNAL_FILES} files)`;
        fail(`${detail}; pack ${serviceName} would be truncated`);
      }
      const size = (await stat(file)).size;
      if (size > MAX_EXTERNAL_FILE_BYTES) {
        const detail = `oversized external file (${size} bytes): ${relative(file)}`;
        fail(`pack ${serviceName}: ${detail}`);
      }
      if (totalBytes + size > MAX_EXTERNAL_TOTAL_BYTES) {
        const detail = `external skill total-size cap reached (${MAX_EXTERNAL_TOTAL_BYTES} bytes)`;
        fail(`${detail}; pack ${serviceName} would be truncated`);
      }
      totalBytes += size;
      const relativeFile = path.relative(sourceRoot, file);
      outputs.push({
        sourceKind: "external",
        renderKind: "external",
        source: relative(file),
        relativeOutput: path.join(outputRoot, skillName, relativeFile),
        content: normalizeExternalSkillFile(relativeFile, await readFile(file, "utf8"), skillName),
      });
    }
  }

  return outputs;
}

export async function optionalMcpOutputs(adapter, context) {
  const outputs = [];
  for (const mcpConfig of adapterMcpConfigs(adapter)) {
    if (mcpConfig.emitOutput === false) continue;
    if (context.mode === "install" && mcpConfig.installMode !== "write") continue;
    if (!mcpConfigScopeAllows(mcpConfig, context.scope)) continue;

    const entries = mcpConfig.includeServices === false
      ? []
      : await selectedMcpServiceEntries(mcpConfig.defaultEnabled, context);
    const rootProperties = mcpConfigRootProperties(mcpConfig, context);
    if (entries.length === 0 && Object.keys(rootProperties).length === 0) continue;
    outputs.push({
      sourceKind: "external",
      renderKind: "mcps",
      source: "registry/optional-services.json",
      relativeOutput: outputRootFor(mcpConfig.relativeOutput, context),
      content: renderMcpConfig(mcpConfig.format, entries, rootProperties),
    });
  }
  return outputs;
}

export async function selectedMcpServiceEntries(defaultEnabled, context) {
  const explicitMcp = context.categoryFilter?.has("mcps") || context.optionalServices;
  if (!defaultEnabled && !explicitMcp) return [];

  const registry = await readOptionalServices();
  // Opt-in contract: external/secret-bearing MCPs are included ONLY when named explicitly
  // via --service. `--category mcps` alone (no --service) selects first-party MCPs only —
  // it must never auto-add any non-first-party server.
  const entries = Object.entries(registry.services)
    .filter(([, service]) => service.kind === "mcp")
    .filter(([id]) => !context.optionalServices || context.optionalServices.has(id))
    .filter(([, service]) => context.optionalServices || service.first_party === true);
  if (context.optionalServices) {
    const known = new Set(entries.map(([id]) => id));
    for (const id of context.optionalServices) {
      if (!known.has(id)) fail(`missing optional MCP service: ${id}`);
    }
  }
  const sorted = entries.sort(([left], [right]) => left.localeCompare(right));
  // Hosts posix_spawn the stdio MCP command directly (no shell), so a literal "~" is never
  // expanded and the server fails to launch (ENOENT). At install time, resolve a leading "~/"
  // to an absolute $HOME path. dist/build keeps "~" so generated output stays machine-agnostic
  // and reproducible. Clone the service so the cached registry object is never mutated.
  if (context.mode !== "install") return sorted;
  return sorted.map(([id, service]) => {
    const command = service.mcp?.server?.command;
    if (typeof command !== "string" || !command.startsWith("~/")) return [id, service];
    return [id, {
      ...service,
      mcp: { ...service.mcp, server: { ...service.mcp.server, command: path.join(os.homedir(), command.slice(2)) } },
    }];
  });
}

export async function externalSkillRoots() {
  const registry = await readOptionalServices();
  const candidates = [];
  const declaredPacks = [];

  for (const [serviceName, service] of Object.entries(registry.services)) {
    if (!["skill-pack", "behavior-pack"].includes(service.kind)) continue;
    const required = service.optional === false || service.status === "required";
    declaredPacks.push(serviceName);
    for (const item of service.skill_roots ?? []) {
      for (const dir of await expandSkillRoot(item)) {
        candidates.push({ root: dir, serviceName, required });
      }
    }
  }

  const seen = new Set();
  const existing = [];
  for (const candidate of candidates) {
    const rel = relative(candidate.root);
    if (seen.has(rel)) continue;
    if (await exists(path.join(candidate.root, "SKILL.md"))) {
      seen.add(rel);
      existing.push(candidate);
    }
  }
  for (const serviceName of declaredPacks) {
    if (!existing.some((candidate) => candidate.serviceName === serviceName)) {
      fail(
        `external skill pack ${serviceName} is unavailable; initialize every registered pack with git submodule update --init --recursive`,
      );
    }
  }
  // Required packs first so a total-size cap can never silently drop a required
  // pack in favor of an optional one; ties resolved by path for determinism.
  return existing.sort(
    (left, right) =>
      Number(right.required) - Number(left.required) || relative(left.root).localeCompare(relative(right.root)),
  );
}

export async function expandSkillRoot(item) {
  if (typeof item !== "string" || item.length === 0) fail("external skill root must be a non-empty string");
  if (item.includes("*") && !item.endsWith("/*")) fail(`external skill root wildcard must be a trailing /*: ${item}`);
  if (item.endsWith("/*")) {
    const base = safeExternalPath(item.slice(0, -2));
    return directDirectories(base);
  }
  return [safeExternalPath(item)];
}

export function safeExternalPath(item) {
  if (!isSafeRelativePath(item) || !item.startsWith("external/")) fail(`unsafe external skill root: ${item}`);
  return path.join(root, item);
}

export function outputRootFor(value, context) {
  return typeof value === "function" ? value(context) : value;
}

export function outputAppliesToScope(output, scope, sourceKindsConfig) {
  const policy = sourceKindPolicy(sourceKindsConfig, output.sourceKind);
  if (!policy) return false;
  return policy.install_scopes.includes(scope);
}

export function outputAppliesToCategory(output, categoryFilter) {
  if (!categoryFilter) return true;
  return categoryFilter.has(output.renderKind) || categoryFilter.has(output.sourceKind);
}

export async function scopedRuleReferenceOutputs(_context, outputRoot) {
  const rules = (await readRules()).filter((rule) => rule.alwaysApply === false);
  return rules.map((rule) => ({
    sourceKind: "rules",
    renderKind: "rules",
    source: rule.file,
    relativeOutput: path.join(outputRoot, `${path.basename(rule.file, ".mdc")}.md`),
    content: renderScopedRuleReferenceDocument(rule),
  }));
}

export async function kiloRuleInstructionPaths(scope) {
  const ruleNames = (await readRules())
    .filter((rule) => rule.alwaysApply !== false)
    .map((rule) => path.basename(rule.file, ".mdc"));
  const prefix = scope === "user" ? "./rules" : ".kilo/rules";
  return ruleNames.map((name) => `${prefix}/${name}.md`);
}

export function commandRelativeOutput(adapter, command, context) {
  return path.join(outputRootFor(adapter.commandOutputRoot, context), adapter.commandOutputName ? adapter.commandOutputName(command, context) : path.basename(command.file));
}

export function skillRelativeOutput(adapter, skill, context) {
  return path.join(outputRootFor(adapter.skillOutputRoot, context), adapter.skillOutputName ? adapter.skillOutputName(skill, context) : path.basename(skill.file));
}

export async function codexOpenAiAgentOutput(source) {
  return codexOpenAiAgentPolicyOutput(source, path.join(".agents", "skills"), true);
}

export async function codexManualOpenAiAgentOutput(source) {
  return codexOpenAiAgentPolicyOutput(source, sharedAgentSkillRoot(), false);
}

export function codexOpenAiAgentPolicyOutput(source, outputRoot, allowImplicitInvocation) {
  const description = yamlBlockString(source.metadata.description ?? firstHeading(source.body) ?? `Run ${source.name.replaceAll("-", " ")}.`);
  return {
    source: source.relativePath,
    relativeOutput: path.join(outputRoot, source.name, "agents", "openai.yaml"),
    content: [
      "interface:",
      `  display_name: "${source.name}"`,
      "  short_description: >-",
      `    ${description}`,
      "policy:",
      `  allow_implicit_invocation: ${allowImplicitInvocation}`,
      "",
    ].join("\n"),
  };
}

export function mcpConfigScopeAllows(mcpConfig, scope) {
  return !mcpConfig.scopes || mcpConfig.scopes.includes(scope);
}

export function mcpConfigRootProperties(mcpConfig, context) {
  return (typeof mcpConfig.rootProperties === "function"
    ? mcpConfig.rootProperties(context)
    : mcpConfig.rootProperties) ?? {};
}

export function adapterMcpConfigs(adapter) {
  if (adapter.mcpConfigs) return adapter.mcpConfigs;
  return adapter.mcpConfig ? [adapter.mcpConfig] : [];
}

export async function antigravityCliStaticOutputs(catalog, context) {
  const rules = await readRules();
  const alwaysApplyRules = rules.filter((rule) => rule.alwaysApply !== false);
  return [
    {
      sourceKind: "commands",
      renderKind: "plugins",
      source: "package.json",
      relativeOutput: path.join("antigravity-cli", "plugins", "agent-surface", "plugin.json"),
      content: `${JSON.stringify({
        name: "agent-surface",
        description: "Portable agent-surface command, skill, subagent, and rule pack generated from Lyther/agent-surface.",
      }, null, 2)}\n`,
    },
    {
      sourceKind: "commands",
      renderKind: "plugins",
      source: "README.md",
      relativeOutput: path.join("antigravity-cli", "plugins", "agent-surface", "README.md"),
      content: [
        "# agent-surface Antigravity CLI plugin",
        "",
        "Generated plugin package for Antigravity CLI.",
        "",
        "Validate and register with `agy plugin validate ~/.gemini/antigravity-cli/plugins/agent-surface`, then `agy plugin install ~/.gemini/antigravity-cli/plugins/agent-surface`.",
        "",
        `Packaged skills: ${catalog.skills.length}`,
        "",
      ].join("\n"),
    },
    ...alwaysApplyRules.map((rule) => ({
      sourceKind: "rules",
      renderKind: "rules",
      source: rule.file,
      relativeOutput: path.join("antigravity-cli", "plugins", "agent-surface", "rules", `${path.basename(rule.file, ".mdc")}.md`),
      content: renderAntigravityCliRuleDocument(rule),
    })),
    ...await scopedRuleReferenceOutputs(
      context,
      path.join("antigravity-cli", "plugins", "agent-surface", "references", "rules"),
    ),
  ];
}

export async function clineStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      relativeOutput: path.join(outputRootFor(clineRuleRoot, context), "agent-surface.md"),
      content: await renderInstructionDocument("agent-surface Cline global rules", "Cline rules"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(outputRootFor(clineRuleRoot, context), "references", "rules")),
  ];
}

export async function codexStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: path.join(".codex", "AGENTS.md"),
      content: await renderInstructionDocument("AGENTS.md - agent-surface global Codex rules", "Codex global instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(".codex", "references", "rules")),
  ];
}

export async function copilotStaticOutputs(_commands, context) {
  const nativeRoot = context.scope === "user" ? ".copilot" : ".github";
  const outputs = [
    {
      sourceKind: "rules",
      renderKind: "instructions",
      source: "rules/*.mdc",
      relativeOutput: copilotInstructionPath(context),
      content: await renderInstructionDocument("agent-surface GitHub Copilot instructions", "GitHub Copilot CLI instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(nativeRoot, "references", "rules")),
  ];
  if (context.scope !== "user") return outputs;
  const instructionRoot = path.join(vsCodeUserRoot("Code", context), "instructions");
  outputs.push(
    {
      sourceKind: "rules",
      renderKind: "instructions",
      source: "rules/*.mdc",
      relativeOutput: path.join(instructionRoot, "agent-surface-copilot.instructions.md"),
      content: await renderVsCodeInstructionDocument("agent-surface Copilot global instructions", "copilot"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(instructionRoot, "references", "rules")),
  );
  return outputs;
}

export async function cursorStaticOutputs() {
  const rules = await readRules();
  return rules.map((rule) => ({
    source: rule.file,
    relativeOutput: path.join(".cursor", "rules", path.basename(rule.file)),
    content: rule.text,
  }));
}

export async function deepagentsStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: deepagentsInstructionPath(context),
      content: await renderInstructionDocument("AGENTS.md - agent-surface Deep Agents Code rules", "Deep Agents Code instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(deepagentsConfigRoot(context), "references", "rules")),
  ];
}

export async function droidStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: droidInstructionPath(context),
      content: await renderInstructionDocument("AGENTS.md - agent-surface Droid rules", "Droid instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(droidConfigRoot(context), "references", "rules")),
  ];
}

export async function grokBuildStaticOutputs(_commands, context) {
  if (context.scope === "user") return [];
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: "AGENTS.md",
      content: await renderInstructionDocument("AGENTS.md - agent-surface Grok Build rules", "Grok Build project instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(".grok", "references", "rules")),
  ];
}

export async function kiloStaticOutputs(_commands, context) {
  const rules = await readRules();
  const alwaysApplyRules = rules.filter((rule) => rule.alwaysApply !== false);
  const scopedRules = rules.filter((rule) => rule.alwaysApply === false);
  const firstPartyMcpEntries = await selectedMcpServiceEntries(true, {
    categoryFilter: null,
    optionalServices: null,
  });
  const outputs = [
    ...alwaysApplyRules.map((rule) => ({
      source: rule.file,
      relativeOutput: path.join(kiloRuleRoot(context), `${path.basename(rule.file, ".mdc")}.md`),
      content: renderKiloRuleDocument(rule),
    })),
  ];
  if (context.mode !== "install") {
    const kiloConfig = {
      $schema: "https://app.kilo.ai/config.json",
      instructions: await kiloRuleInstructionPaths(context.scope),
      permission: { "*": "allow" },
      share: "disabled",
    };
    if (firstPartyMcpEntries.length > 0) {
      kiloConfig.mcp = optionalServiceMcpServers(firstPartyMcpEntries, "local-command-map");
    }
    outputs.unshift({
      source: "rules/*.mdc",
      relativeOutput: kiloConfigPath(context.scope),
      content: `${JSON.stringify(kiloConfig, null, 2)}\n`,
    });
  }
  outputs.push(...scopedRules.map((rule) => ({
    source: rule.file,
    relativeOutput: path.join(kiloRuleReferenceRoot(context), `${path.basename(rule.file, ".mdc")}.md`),
    content: renderScopedRuleReferenceDocument(rule),
  })));
  return outputs;
}

export async function kimiCodeStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: kimiCodeInstructionPath(context),
      content: await renderInstructionDocument("AGENTS.md - agent-surface Kimi Code rules", "Kimi Code instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(kimiCodeConfigRoot(context), "references", "rules")),
  ];
}

export async function qoderStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: qoderInstructionPath(context),
      content: await renderInstructionDocument("AGENTS.md - agent-surface Qoder rules", "Qoder instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(qoderConfigRoot(context), "references", "rules")),
  ];
}

export async function qwenCodeStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: qwenCodeInstructionPath(context),
      content: await renderInstructionDocument("QWEN.md - agent-surface Qwen Code rules", "Qwen Code instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(qwenCodeConfigRoot(context), "references", "rules")),
  ];
}

export async function kiroStaticOutputs(_commands, context) {
  const rules = await readRules();
  return rules.map((rule) => ({
    source: rule.file,
    renderKind: "rules",
    relativeOutput: path.join(kiroSteeringRoot(context), `${path.basename(rule.file, ".mdc")}.md`),
    content: renderKiroRuleDocument(rule),
  }));
}

export async function opencodeStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      relativeOutput: opencodeInstructionPath(context),
      content: await renderInstructionDocument("AGENTS.md - agent-surface global OpenCode rules", "OpenCode global instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(opencodeConfigRoot(context), "references", "rules")),
  ];
}

export async function openhandsStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: openhandsInstructionPath(context),
      content: await renderInstructionDocument("AGENTS.md - agent-surface OpenHands rules", "OpenHands instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(openhandsConfigRoot(context), "references", "rules")),
  ];
}

export async function piStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: piInstructionPath(context),
      content: await renderInstructionDocument("AGENTS.md - agent-surface Pi rules", "Pi instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(piConfigRoot(context), "references", "rules")),
  ];
}

export async function poolStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: poolInstructionPath(context),
      content: await renderInstructionDocument("agent-surface Poolside rules", "Poolside instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(poolConfigRoot(context), "references", "rules")),
  ];
}

export async function traeStaticOutputs(_commands, context) {
  const rules = await readRules();
  return [
    {
      source: "rules/*.mdc",
      relativeOutput: path.join(".trae", "user_rules.md"),
      content: await renderInstructionDocument("agent-surface Trae user rules", "Trae user rules"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(".trae", "references", "rules")),
    ...rules.map((rule) => ({
      sourceKind: "rules",
      renderKind: "rules",
      source: rule.file,
      relativeOutput: path.join(traeRuleRoot(context), `${path.basename(rule.file, ".mdc")}.md`),
      content: rule.text,
    })),
  ];
}

export async function traeCliSkillOutput(source) {
  return {
    source: source.relativePath,
    relativeOutput: path.join(traeCliSkillRoot(), codexSkillOutputName(source)),
    content: await renderVanillaSkill(source),
  };
}

export async function traeCliCommandOutput(source) {
  return {
    source: source.relativePath,
    relativeOutput: path.join(traeCliSkillRoot(), codexSkillOutputName(source)),
    content: await renderManualPortableSkill(source),
  };
}

export async function vscodeStaticOutputs(_commands, context) {
  const instructionRoot = path.join(vsCodeUserRoot("Code", context), "instructions");
  return [
    {
      sourceKind: "rules",
      renderKind: "instructions",
      source: "rules/*.mdc",
      relativeOutput: path.join(instructionRoot, "agent-surface.instructions.md"),
      content: await renderVsCodeInstructionDocument("agent-surface VS Code instructions", "vscode"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(instructionRoot, "references", "rules")),
  ];
}

export async function windsurfStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: windsurfRulePath(context),
      content: await renderInstructionDocument("agent-surface Windsurf rules", "Windsurf instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(windsurfConfigRoot(context), "references", "rules")),
  ];
}

export async function zedStaticOutputs(_commands, context) {
  return [
    {
      source: "rules/*.mdc",
      renderKind: "rules",
      relativeOutput: zedInstructionPath(context),
      content: await renderInstructionDocument("AGENTS.md - agent-surface Zed rules", "Zed instructions"),
    },
    ...await scopedRuleReferenceOutputs(context, path.join(zedConfigRoot(context), "references", "rules")),
  ];
}

export function yamlBlockString(value) {
  return value.replace(/\s+/g, " ").trim().replaceAll('"', '\\"');
}

export function sourceKindPolicy(sourceKindsConfig, sourceKind) {
  return sourceKind ? sourceKindsConfig.source_kinds[sourceKind] : null;
}
