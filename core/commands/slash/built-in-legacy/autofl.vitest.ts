import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../tools/implementations/runTerminalCommand.js", () => ({
  runTerminalCommandImpl: vi.fn(),
}));

vi.mock("../../../config/markdown/loadMarkdownSkills.js", () => ({
  loadMarkdownSkills: vi.fn(),
}));

import AutoFLSlashCommand from "./autofl";
import { loadMarkdownSkills } from "../../../config/markdown/loadMarkdownSkills.js";
import { runTerminalCommandImpl } from "../../../tools/implementations/runTerminalCommand.js";

const mockRunTerminalCommandImpl = vi.mocked(runTerminalCommandImpl);
const mockLoadMarkdownSkills = vi.mocked(loadMarkdownSkills);

async function collectAsyncGenerator(gen: AsyncGenerator<string | undefined>) {
  const chunks: string[] = [];
  for await (const chunk of gen) {
    if (chunk) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

describe("AutoFL built-in slash command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadMarkdownSkills.mockResolvedValue({ skills: [], errors: [] });
  });

  it("runs the provided test command and analyzes captured output", async () => {
    const command =
      "python -m unittest -q tornado.test.httputil_test.TestUrlConcat.test_url_concat_none_params";
    const terminalOutput = [
      "Traceback (most recent call last):",
      '  File "C:\\repo\\tornado\\test\\httputil_test.py", line 70, in test_url_concat_none_params',
      "    url = url_concat(",
      '  File "C:\\repo\\tornado\\httputil.py", line 621, in url_concat',
      "    raise TypeError(err)",
      "TypeError: 'args' parameter should be dict, list or tuple. Not <class 'NoneType'>",
    ].join("\n");

    mockRunTerminalCommandImpl.mockResolvedValue([
      {
        name: "Terminal",
        description: "Terminal command output",
        content: terminalOutput,
        status: "Command failed with exit code 1",
      },
    ]);

    let capturedPrompt = "";
    const llm = {
      streamChat: vi.fn((messages) => {
        capturedPrompt = messages[0].content;
        async function* generator() {
          yield {
            role: "assistant",
            content: "tornado/httputil.py url_concat",
          } as any;
        }
        return generator();
      }),
    };
    const ide = {
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///C:/repo"]),
      readFile: vi.fn(async (uri: string) => {
        if (uri.includes("httputil_test.py")) {
          return [
            "class TestUrlConcat:",
            "    def test_url_concat_none_params(self):",
            "        url = url_concat(",
            '            "https://localhost/path?r=1&t=2",',
            "            None,",
            "        )",
          ].join("\n");
        }
        return [
          "def url_concat(url, args):",
          "    if not isinstance(args, (dict, list, tuple)):",
          '        err = "bad args"',
          "        raise TypeError(err)",
        ].join("\n");
      }),
    };

    const chunks = await collectAsyncGenerator(
      AutoFLSlashCommand.run({
        input: command,
        ide,
        llm,
        fetch: vi.fn(),
        abortController: new AbortController(),
        history: [],
        contextItems: [],
        selectedCode: [],
        config: {} as any,
        addContextItem: vi.fn(),
      } as any),
    );

    expect(mockRunTerminalCommandImpl).toHaveBeenCalledWith(
      { command, waitForCompletion: true },
      expect.objectContaining({ ide, llm }),
    );
    expect(capturedPrompt).toContain(
      "AutoFL executed this test command itself",
    );
    expect(capturedPrompt).toContain("Command failed with exit code 1");
    expect(capturedPrompt).toContain("tornado/httputil.py");
    expect(capturedPrompt).toContain("url_concat");
    expect(capturedPrompt).toContain("test_url_concat_none_params");
    expect(chunks.join("\n")).toContain("tornado/httputil.py");
  });

  it("asks for a test command when input is empty", async () => {
    const chunks = await collectAsyncGenerator(
      AutoFLSlashCommand.run({
        input: "",
        ide: {},
        llm: {},
        fetch: vi.fn(),
        abortController: new AbortController(),
        history: [],
        contextItems: [],
        selectedCode: [],
        config: {} as any,
        addContextItem: vi.fn(),
      } as any),
    );

    expect(mockRunTerminalCommandImpl).not.toHaveBeenCalled();
    expect(chunks.join("\n")).toContain("테스트 명령을 확정하지 못했습니다");
  });

  it("asks for a test command when the input is natural language without a command", async () => {
    const chunks = await collectAsyncGenerator(
      AutoFLSlashCommand.run({
        input: "tornado9 실패 좀 봐줘",
        ide: {},
        llm: {},
        fetch: vi.fn(),
        abortController: new AbortController(),
        history: [],
        contextItems: [],
        selectedCode: [],
        config: {} as any,
        addContextItem: vi.fn(),
      } as any),
    );

    expect(mockRunTerminalCommandImpl).not.toHaveBeenCalled();
    expect(chunks.join("\n")).toContain("실패하는 테스트를 재현하는 명령");
  });

  it("extracts a test command from natural-language input", async () => {
    const command =
      "cd manual-testing-sandbox/kaist/tornado9; python -m unittest -q tornado.test.httputil_test.TestUrlConcat.test_url_concat_none_params";
    mockRunTerminalCommandImpl.mockResolvedValue([
      {
        name: "Terminal",
        description: "Terminal command output",
        content: "FAILED (errors=1)",
        status: "Command failed with exit code 1",
      },
    ]);

    const llm = {
      streamChat: vi.fn(() => {
        async function* generator() {
          yield {
            role: "assistant",
            content: "tornado/httputil.py url_concat",
          } as any;
        }
        return generator();
      }),
    };

    await collectAsyncGenerator(
      AutoFLSlashCommand.run({
        input: `이 테스트로 한번 봐주세요: ${command}`,
        ide: {
          getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///C:/repo"]),
          readFile: vi.fn(),
        },
        llm,
        fetch: vi.fn(),
        abortController: new AbortController(),
        history: [],
        contextItems: [],
        selectedCode: [],
        config: {} as any,
        addContextItem: vi.fn(),
      } as any),
    );

    expect(mockRunTerminalCommandImpl).toHaveBeenCalledWith(
      { command, waitForCompletion: true },
      expect.anything(),
    );
  });

  it("keeps meaningful natural-language report instructions separate from the command", async () => {
    const command =
      "cd manual-testing-sandbox/kaist/tornado9; python -m unittest -q tornado.test.httputil_test.TestUrlConcat.test_url_concat_none_params";
    const reportInstruction = "한국어로 5줄 이내로 답해주세요.";
    mockRunTerminalCommandImpl.mockResolvedValue([
      {
        name: "Terminal",
        description: "Terminal command output",
        content: "FAILED (errors=1)",
        status: "Command failed with exit code 1",
      },
    ]);

    let capturedPrompt = "";
    const llm = {
      streamChat: vi.fn((messages) => {
        capturedPrompt = messages[0].content;
        async function* generator() {
          yield {
            role: "assistant",
            content: "진단 결과",
          } as any;
        }
        return generator();
      }),
    };

    await collectAsyncGenerator(
      AutoFLSlashCommand.run({
        input: `${reportInstruction} 이 테스트로 AutoFL 돌려줘: ${command}`,
        ide: {
          getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///C:/repo"]),
          readFile: vi.fn(),
        },
        llm,
        fetch: vi.fn(),
        abortController: new AbortController(),
        history: [],
        contextItems: [],
        selectedCode: [],
        config: {} as any,
        addContextItem: vi.fn(),
      } as any),
    );

    expect(mockRunTerminalCommandImpl).toHaveBeenCalledWith(
      { command, waitForCompletion: true },
      expect.anything(),
    );
    expect(capturedPrompt).toContain("한국어로 5줄 이내로 답해주세요");
    expect(capturedPrompt).toContain("기본적으로 한국어로 작성하세요");
    expect(capturedPrompt).not.toContain("이 테스트로 AutoFL 돌려줘");
  });

  it("asks for a corrected command when the command does not start a test run", async () => {
    const command = "pytest tests/test_missing.py";
    mockRunTerminalCommandImpl.mockResolvedValue([
      {
        name: "Terminal",
        description: "Terminal command output",
        content:
          "pytest: The term 'pytest' is not recognized as the name of a cmdlet",
        status: "Command failed with exit code 1",
      },
    ]);

    const llm = {
      streamChat: vi.fn(),
    };

    const chunks = await collectAsyncGenerator(
      AutoFLSlashCommand.run({
        input: command,
        ide: {
          getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///C:/repo"]),
          readFile: vi.fn(),
        },
        llm,
        fetch: vi.fn(),
        abortController: new AbortController(),
        history: [],
        contextItems: [],
        selectedCode: [],
        config: {} as any,
        addContextItem: vi.fn(),
      } as any),
    );

    expect(mockRunTerminalCommandImpl).toHaveBeenCalled();
    expect(llm.streamChat).not.toHaveBeenCalled();
    expect(chunks.join("\n")).toContain("테스트 실행 전에 명령 또는 환경 문제");
  });

  it("executes only the command before an inline AutoFL instruction", async () => {
    const command =
      "python -m unittest -q tornado.test.httputil_test.TestUrlConcat.test_url_concat_none_params";
    const additionalInstructions =
      "한국어로 답하고 마지막 줄에 AUTOFL_TORNADO9_DONE 을 포함하세요.";
    mockRunTerminalCommandImpl.mockResolvedValue([
      {
        name: "Terminal",
        description: "Terminal command output",
        content: "FAILED (errors=1)",
        status: "Command failed with exit code 1",
      },
    ]);

    let capturedPrompt = "";
    const llm = {
      streamChat: vi.fn((messages) => {
        capturedPrompt = messages[0].content;
        async function* generator() {
          yield {
            role: "assistant",
            content: "AUTOFL_TORNADO9_DONE",
          } as any;
        }
        return generator();
      }),
    };

    await collectAsyncGenerator(
      AutoFLSlashCommand.run({
        input: `${command} # autofl: ${additionalInstructions}`,
        ide: {
          getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///C:/repo"]),
          readFile: vi.fn(),
        },
        llm,
        fetch: vi.fn(),
        abortController: new AbortController(),
        history: [],
        contextItems: [],
        selectedCode: [],
        config: {} as any,
        addContextItem: vi.fn(),
      } as any),
    );

    expect(mockRunTerminalCommandImpl).toHaveBeenCalledWith(
      { command, waitForCompletion: true },
      expect.anything(),
    );
    expect(capturedPrompt).toContain(additionalInstructions);
  });

  it("includes optional AutoFL skill guidance when the workspace defines it", async () => {
    const command = "pytest tests/test_bug.py::test_failure";
    mockLoadMarkdownSkills.mockResolvedValue({
      skills: [
        {
          name: "autofl-fault-localization",
          description: "AutoFL execution discipline",
          content:
            "Treat AutoFL as an executable fault-localization workflow, not as a log-analysis prompt.",
          path: ".continue/skills/autofl-fault-localization/SKILL.md",
          files: [],
        },
      ],
      errors: [],
    });
    mockRunTerminalCommandImpl.mockResolvedValue([
      {
        name: "Terminal",
        description: "Terminal command output",
        content: "FAILED tests/test_bug.py::test_failure",
        status: "Command failed with exit code 1",
      },
    ]);

    let capturedPrompt = "";
    const llm = {
      streamChat: vi.fn((messages) => {
        capturedPrompt = messages[0].content;
        async function* generator() {
          yield {
            role: "assistant",
            content: "diagnosis",
          } as any;
        }
        return generator();
      }),
    };

    await collectAsyncGenerator(
      AutoFLSlashCommand.run({
        input: command,
        ide: {
          getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///C:/repo"]),
          readFile: vi.fn(),
        },
        llm,
        fetch: vi.fn(),
        abortController: new AbortController(),
        history: [],
        contextItems: [],
        selectedCode: [],
        config: {} as any,
        addContextItem: vi.fn(),
      } as any),
    );

    expect(mockLoadMarkdownSkills).toHaveBeenCalled();
    expect(capturedPrompt).toContain(
      "AutoFL loaded this Continue skill guidance",
    );
    expect(capturedPrompt).toContain(
      "Treat AutoFL as an executable fault-localization workflow",
    );
  });
});
