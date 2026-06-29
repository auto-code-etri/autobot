import path from "node:path";

import { ContextItem, SlashCommand } from "../../../index.js";
import { loadMarkdownSkills } from "../../../config/markdown/loadMarkdownSkills.js";
import { AUTOFL_ANALYSIS_PROMPT } from "../../../config/prompts.js";
import { runTerminalCommandTool } from "../../../tools/definitions/runTerminalCommand.js";
import { runTerminalCommandImpl } from "../../../tools/implementations/runTerminalCommand.js";
import { renderChatMessage } from "../../../util/messageContent.js";
import {
  localPathOrUriToPath,
  localPathToUri,
} from "../../../util/pathToUri.js";

const MAX_OUTPUT_CHARS = 14_000;
const MAX_SNIPPET_FILES = 5;
const SNIPPET_RADIUS = 30;
const AUTOFL_SKILL_NAME = "autofl-fault-localization";

type TraceLocation = {
  filePath: string;
  line: number;
  symbol?: string;
};

type ParsedAutoFLInput = {
  command: string;
  additionalInstructions: string;
};

const TEST_COMMAND_PATTERNS = [
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*(?:python(?:3)?|py)\s+-m\s+(?:pytest|unittest)\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*(?:pytest|py\.test)\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*npx\s+(?:vitest|jest|mocha)\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*(?:npm|pnpm|yarn)\s+(?:test|run\s+[^\r\n]*test[^\r\n]*)\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*bun\s+test\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*(?:vitest|jest|mocha)\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*go\s+test\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*cargo\s+test\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*dotnet\s+test\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*(?:mvn|mvnw|\.\/mvnw|\.\\mvnw)\s+test\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*(?:gradle|gradlew|\.\/gradlew|\.\\gradlew)\s+test\b`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*(?:bash|sh)\s+[^\r\n]*(?:test|pytest|unittest)[^\r\n]*`,
  String.raw`(?:(?:cd|pushd)\s+[^;&\r\n]+(?:\s*(?:;|&&)\s*)+)*(?:\.\/|\.\\)[^\r\n]*(?:test|pytest|unittest)[^\r\n]*`,
];

function cleanCandidateCommand(command: string): string {
  return command
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[。]+$/g, "")
    .trim();
}

function stripTrailingReportInstructions(command: string): string {
  return command
    .replace(
      /\s+(?:그리고|그다음|다음으로|then|and)\s+(?:한국어|한글|답|답변|설명|알려|보고|report|answer|respond)\b[\s\S]*$/i,
      "",
    )
    .trim();
}

function cleanPotentialUserInstructions(value: string): string {
  const cleaned = value
    .replace(/^[\s:：,，.;；\-–—]+|[\s:：,，.;；\-–—]+$/g, "")
    .trim();

  if (!cleaned) {
    return "";
  }

  if (
    !/(한국어|한글|영어|English|Korean|줄|line|간단|자세|형식|format|마지막|marker|포함|include|답|답변|설명|요약|answer|respond|report)/i.test(
      cleaned,
    )
  ) {
    return "";
  }

  return cleaned
    .replace(
      /(?:이\s*)?(?:테스트|명령)(?:로|을|를|으로)?\s*(?:AutoFL\s*)?(?:돌려줘|돌려|실행해줘|실행해|봐줘|분석해줘|분석해|확인해줘|확인해)\s*[:：]?/gi,
      "",
    )
    .replace(
      /(?:run|check|analyze)\s+(?:this\s+)?(?:test|command)\s*[:：]?/gi,
      "",
    )
    .replace(/^[\s:：,，.;；\-–—]+|[\s:：,，.;；\-–—]+$/g, "")
    .trim();
}

function extractUserInstructionsAroundCommand(
  value: string,
  command: string,
): string {
  const commandIndex = value.indexOf(command);
  if (commandIndex < 0) {
    return "";
  }

  return cleanPotentialUserInstructions(
    [
      value.slice(0, commandIndex),
      value.slice(commandIndex + command.length),
    ].join("\n"),
  );
}

function extractKnownTestCommand(value: string): string | undefined {
  const inlineCode = value.match(/`([^`\r\n]+)`/);
  if (inlineCode?.[1]) {
    const command = extractKnownTestCommand(inlineCode[1]);
    if (command) {
      return command;
    }
  }

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    for (const pattern of TEST_COMMAND_PATTERNS) {
      const match = line.match(
        new RegExp(`(?<command>${pattern}[^\\r\\n]*)`, "i"),
      );
      if (match?.groups?.command) {
        return cleanCandidateCommand(
          stripTrailingReportInstructions(match.groups.command),
        );
      }
    }
  }

  return undefined;
}

function parseAutoFLInput(input: string): ParsedAutoFLInput | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  const inlineInstructions = trimmed.match(
    /^(?<command>.+?)\s+(?:#|\/\/)\s*autofl:\s*(?<instructions>.+)$/i,
  );
  if (
    inlineInstructions?.groups?.command?.trim() &&
    inlineInstructions.groups.instructions?.trim()
  ) {
    const rawCommand = inlineInstructions.groups.command.trim();
    return {
      command: extractKnownTestCommand(rawCommand) ?? rawCommand,
      additionalInstructions: inlineInstructions.groups.instructions.trim(),
    };
  }

  const fenced = trimmed.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) {
    const command =
      extractKnownTestCommand(fenced[1]) ??
      fenced[1].trim().split(/\r?\n/)[0]?.trim();
    return command
      ? {
          command,
          additionalInstructions: cleanPotentialUserInstructions(
            trimmed.replace(fenced[0], ""),
          ),
        }
      : undefined;
  }

  const labelled = trimmed.match(
    /(?:test[_\s-]*command|command|cmd|명령|테스트\s*명령)\s*[:=]\s*(.+)/i,
  );
  if (labelled?.[1]?.trim()) {
    const command =
      extractKnownTestCommand(labelled[1]) ??
      labelled[1].trim().split(/\r?\n/)[0]?.trim();
    return command
      ? {
          command,
          additionalInstructions: cleanPotentialUserInstructions(
            trimmed.replace(labelled[0], ""),
          ),
        }
      : undefined;
  }

  const command = extractKnownTestCommand(trimmed);
  return command
    ? {
        command,
        additionalInstructions: extractUserInstructionsAroundCommand(
          trimmed,
          command,
        ),
      }
    : undefined;
}

function looksLikeCommandSetupFailure(output: string): boolean {
  return [
    /command not found/i,
    /is not recognized as (?:the name of )?(?:a cmdlet|an internal or external command)/i,
    /The system cannot find the path specified/i,
    /(?:cd|pushd|Set-Location):?.*No such file or directory/i,
    /Cannot find path/i,
    /can't open file/i,
    /No module named (?:pytest|unittest)/i,
  ].some((pattern) => pattern.test(output));
}

function summarizeCommandSetupFailure(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    lines.find((line) =>
      /command not found|not recognized|cannot find|No such file|can't open file|No module named/i.test(
        line,
      ),
    ) ??
    lines.slice(-1)[0] ??
    "테스트 명령 실행 방법을 확인할 수 없습니다."
  );
}

function askForTestCommandMessage(input?: string): string {
  return [
    "AutoFL이 실행할 테스트 명령을 확정하지 못했습니다.",
    "",
    input ? `입력으로 받은 내용: \`${input.trim()}\`` : undefined,
    "실패하는 테스트를 재현하는 명령을 알려주세요.",
    "",
    "예:",
    "`/autofl python -m unittest -q package.test_module.TestCase.test_name`",
    "`/autofl pytest tests/test_example.py::test_failure`",
  ]
    .filter(Boolean)
    .join("\n");
}

function truncateMiddle(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  const headLength = Math.floor(maxChars * 0.55);
  const tailLength = maxChars - headLength;
  return `${value.slice(0, headLength)}\n\n[... AutoFL truncated ${value.length - maxChars} characters ...]\n\n${value.slice(-tailLength)}`;
}

function normalizePathSeparators(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isWithin(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return (
    relative === "" ||
    (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function resolveTracePath(
  rawPath: string,
  workspacePaths: string[],
): string | undefined {
  const cleaned = rawPath.trim().replace(/^file:\/\//, "");
  const candidatePaths = path.isAbsolute(cleaned)
    ? [cleaned]
    : workspacePaths.map((workspacePath) =>
        path.resolve(workspacePath, cleaned),
      );

  return candidatePaths.find((candidate) =>
    workspacePaths.some((workspacePath) => isWithin(candidate, workspacePath)),
  );
}

function extractTraceLocations(
  output: string,
  workspacePaths: string[],
): TraceLocation[] {
  const locations: TraceLocation[] = [];
  const seen = new Set<string>();

  const addLocation = (rawPath: string, rawLine: string, symbol?: string) => {
    const line = Number.parseInt(rawLine, 10);
    if (!Number.isFinite(line) || line < 1) {
      return;
    }

    const resolved = resolveTracePath(rawPath, workspacePaths);
    if (!resolved) {
      return;
    }

    const key = `${resolved}:${line}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    locations.push({ filePath: resolved, line, symbol });
  };

  const pythonFrameRegex =
    /File\s+"([^"]+)",\s+line\s+(\d+),\s+in\s+([^\r\n]+)/g;
  for (const match of output.matchAll(pythonFrameRegex)) {
    addLocation(match[1], match[2], match[3]);
  }

  const genericFrameRegex =
    /((?:[A-Za-z]:\\|\/|\.\/|\.\.\/)?[^\s"'()<>|]+?\.(?:py|js|jsx|ts|tsx|java|kt|go|rs|c|cc|cpp|h|hpp))[:(, ]+line\s+(\d+)/gi;
  for (const match of output.matchAll(genericFrameRegex)) {
    addLocation(match[1], match[2]);
  }

  return locations.slice(0, MAX_SNIPPET_FILES);
}

function buildSnippet(content: string, centerLine: number): string {
  const lines = content.split(/\r?\n/);
  const start = Math.max(1, centerLine - SNIPPET_RADIUS);
  const end = Math.min(lines.length, centerLine + SNIPPET_RADIUS);

  return lines
    .slice(start - 1, end)
    .map((line, index) => {
      const lineNumber = start + index;
      const marker = lineNumber === centerLine ? ">" : " ";
      return `${marker} ${String(lineNumber).padStart(5, " ")} | ${line}`;
    })
    .join("\n");
}

async function collectSourceSnippets(
  output: string,
  workspaceDirs: string[],
  ide: Parameters<SlashCommand["run"]>[0]["ide"],
): Promise<string> {
  const workspacePaths = workspaceDirs.map(localPathOrUriToPath);
  const locations = extractTraceLocations(output, workspacePaths);
  if (locations.length === 0) {
    return "AutoFL did not find readable stack-frame source locations in the command output.";
  }

  const snippets: string[] = [];
  for (const location of locations) {
    try {
      const fileContent = await ide.readFile(localPathToUri(location.filePath));
      snippets.push(
        [
          `File: ${normalizePathSeparators(location.filePath)}`,
          `Frame: line ${location.line}${location.symbol ? `, in ${location.symbol}` : ""}`,
          "```",
          buildSnippet(fileContent, location.line),
          "```",
        ].join("\n"),
      );
    } catch (e) {
      snippets.push(
        `File: ${normalizePathSeparators(location.filePath)}\nAutoFL could not read this stack-frame source file: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return snippets.join("\n\n");
}

function terminalContextToText(items: ContextItem[]): string {
  return items
    .map((item) =>
      [`[${item.name}] ${item.status ?? item.description}`, item.content]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

async function loadAutoFLSkillGuidance(
  ide: Parameters<SlashCommand["run"]>[0]["ide"],
): Promise<string | undefined> {
  try {
    const { skills } = await loadMarkdownSkills(ide);
    const skill = skills.find(
      (candidate) => candidate.name === AUTOFL_SKILL_NAME,
    );
    if (!skill) {
      return undefined;
    }

    return truncateMiddle(
      [
        "AutoFL loaded this Continue skill guidance:",
        `<skill_name>${skill.name}</skill_name>`,
        `<skill_description>${skill.description}</skill_description>`,
        "<skill_content>",
        skill.content,
        "</skill_content>",
        skill.files.length > 0
          ? `<skill_supporting_files>${skill.files.join("\n")}</skill_supporting_files>`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      6_000,
    );
  } catch (error) {
    return `AutoFL could not load optional Continue skill guidance: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const AutoFLSlashCommand: SlashCommand = {
  name: "autofl",
  description: "Run a failing test and localize the fault",
  run: async function* ({ ide, llm, input, fetch, config, abortController }) {
    const parsedInput = parseAutoFLInput(input);
    if (!parsedInput) {
      yield askForTestCommandMessage(input);
      return;
    }
    const { command, additionalInstructions } = parsedInput;

    yield `AutoFL이 테스트 명령을 실행합니다:\n\n\`\`\`shell\n${command}\n\`\`\`\n`;

    const terminalItems = await runTerminalCommandImpl(
      { command, waitForCompletion: true },
      { ide, llm, fetch, config, tool: runTerminalCommandTool },
    );
    const terminalOutput = terminalContextToText(terminalItems);
    yield `AutoFL이 터미널 출력을 캡처했습니다:\n\n\`\`\`text\n${truncateMiddle(terminalOutput, 4_000)}\n\`\`\`\n`;

    if (looksLikeCommandSetupFailure(terminalOutput)) {
      yield [
        "AutoFL이 테스트 실행 전에 명령 또는 환경 문제를 감지했습니다.",
        "",
        `실행한 명령: \`${command}\``,
        `감지한 오류: ${summarizeCommandSetupFailure(terminalOutput)}`,
        "",
        "실패 테스트를 실제로 실행할 수 있는 명령을 다시 알려주세요.",
      ].join("\n");
      return;
    }

    const workspaceDirs = await ide.getWorkspaceDirs();
    const sourceSnippets = await collectSourceSnippets(
      terminalOutput,
      workspaceDirs,
      ide,
    );
    const skillGuidance = await loadAutoFLSkillGuidance(ide);

    const prompt = [
      AUTOFL_ANALYSIS_PROMPT,
      "",
      skillGuidance ?? "",
      "",
      "AutoFL executed this test command itself:",
      "```shell",
      command,
      "```",
      "",
      "AutoFL captured this terminal output:",
      "```",
      truncateMiddle(terminalOutput, MAX_OUTPUT_CHARS),
      "```",
      "",
      "AutoFL inspected these stack-frame source snippets:",
      sourceSnippets,
      "",
      additionalInstructions
        ? `Additional user instructions for the report format:\n${additionalInstructions}\n`
        : "",
      "Report the diagnosis and ranked suspected buggy locations. Include the executed command and whether the command failed or passed. Keep the answer concise unless the user explicitly asked for more detail.",
      "최종 답변은 기본적으로 한국어로 작성하세요. 사용자가 명시적으로 다른 언어를 요청한 경우에만 그 언어를 사용하세요.",
    ].join("\n");

    for await (const chunk of llm.streamChat(
      [{ role: "user", content: prompt }],
      abortController.signal,
    )) {
      yield renderChatMessage(chunk);
    }
  },
};

export default AutoFLSlashCommand;
