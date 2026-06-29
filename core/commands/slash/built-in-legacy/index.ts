import {
  SlashCommand,
  SlashCommandDescription,
  SlashCommandWithSource,
} from "../../..";
import AutoFLSlashCommand from "./autofl";
import GenerateTerminalCommand from "./cmd";
import CommitMessageCommand from "./commit";
import HttpSlashCommand from "./http";
import OnboardSlashCommand from "./onboard";
import ReviewMessageCommand from "./review";
import ShareSlashCommand from "./share";

const LegacyBuiltInSlashCommands: SlashCommand[] = [
  AutoFLSlashCommand,
  ShareSlashCommand,
  GenerateTerminalCommand,
  HttpSlashCommand,
  CommitMessageCommand,
  ReviewMessageCommand,
  OnboardSlashCommand,
];

export function getLegacyBuiltInSlashCommandFromDescription(
  desc: SlashCommandDescription,
): SlashCommandWithSource | undefined {
  const cmd = LegacyBuiltInSlashCommands.find((cmd) => cmd.name === desc.name);
  if (!cmd) {
    return undefined;
  }
  return {
    ...cmd,
    params: desc.params,
    description: desc.description ?? cmd.description,
    source: "built-in-legacy",
  };
}
