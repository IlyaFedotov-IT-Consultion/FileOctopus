import { COMMAND_REGISTRY } from "./registryData";

export type CommandId = (typeof COMMAND_REGISTRY)[number]["id"];

export type CommandGroup = (typeof COMMAND_REGISTRY)[number]["group"];

export interface CommandDefinition {
  readonly id: CommandId;
  readonly label: string;
  readonly group: CommandGroup;
  readonly shortcutMac?: string;
  readonly shortcutWin?: string;
  readonly destructive?: boolean;
}
