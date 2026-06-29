import {
  MessagePart,
  RangeInFile,
  SlashCommandDescWithSource,
  TextMessagePart,
} from "core";
import { describe, expect, it } from "vitest";

import { MockIdeMessenger } from "../../../../context/MockIdeMessenger";
import { renderSlashCommandPrompt } from "./renderSlashCommand";

function getAutoflSlashCommand(): SlashCommandDescWithSource {
  return {
    name: "autofl",
    description: "Run a failing test and localize the fault",
    isLegacy: true,
    source: "built-in-legacy",
  };
}

describe("renderSlashCommandPrompt AutoFL slash command", () => {
  it("routes /autofl input through the built-in runner", async () => {
    const parts: MessagePart[] = [
      {
        type: "text",
        text: "pytest tests/test_math_utils.py::test_add",
      },
    ];
    const selectedCode: RangeInFile[] = [
      {
        filepath: "file:///workspace/math_utils.py",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 16 },
        },
      },
    ];

    const result = await renderSlashCommandPrompt(
      new MockIdeMessenger(),
      "autofl",
      parts,
      [getAutoflSlashCommand()],
      selectedCode,
    );

    expect(result.legacyCommandWithInput).toMatchObject({
      command: {
        name: "autofl",
        source: "built-in-legacy",
      },
      input: "pytest tests/test_math_utils.py::test_add",
    });
    expect(result.contextRequests).toEqual([]);
    expect(selectedCode).toHaveLength(1);

    const [message] = result.slashedParts;
    expect(message.type).toBe("text");

    const rendered = (message as TextMessagePart).text;
    expect(rendered).toBe("/autofl pytest tests/test_math_utils.py::test_add");
    expect(rendered).not.toContain("{{{ input }}}");
  });
});
