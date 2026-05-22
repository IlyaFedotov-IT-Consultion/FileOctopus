import type { CommandDefinition, CommandGroup, CommandId } from "./types";
import { COMMAND_REGISTRY } from "./registryData";

export const COMMAND_DEFINITIONS: readonly CommandDefinition[] =
  COMMAND_REGISTRY as unknown as readonly CommandDefinition[];

const byId = new Map<CommandId, CommandDefinition>(
  COMMAND_DEFINITIONS.map((command) => [command.id, command]),
);

export function getCommand(id: CommandId): CommandDefinition {
  const command = byId.get(id);
  if (!command) {
    throw new Error(`Unknown command: ${id}`);
  }
  return command;
}

export function commandsInGroup(group: CommandGroup): CommandDefinition[] {
  return COMMAND_DEFINITIONS.filter((command) => command.group === group);
}

export const TOOLBAR_GROUPS: CommandGroup[] = [
  "navigation",
  "creation",
  "operation",
  "view",
];

export function formatCommandShortcut(
  id: CommandId,
  platform: "mac" | "windowsLinux" = "windowsLinux",
): string | undefined {
  const command = byId.get(id);
  if (!command) {
    return undefined;
  }
  return platform === "mac" ? command.shortcutMac : command.shortcutWin;
}
