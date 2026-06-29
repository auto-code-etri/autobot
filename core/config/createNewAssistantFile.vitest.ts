import { describe, expect, it, vi } from "vitest";

import { createNewAssistantFile } from "./createNewAssistantFile";

describe("createNewAssistantFile", () => {
  it("does not copy built-in AutoFL into new agent prompt blocks", async () => {
    const writeFile = vi.fn();
    const openFile = vi.fn();
    const ide = {
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
      fileExists: vi.fn().mockResolvedValue(false),
      writeFile,
      openFile,
    } as any;

    await createNewAssistantFile(ide, undefined);

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [, content] = writeFile.mock.calls[0];
    expect(content).toContain("prompts: []");
    expect(content).not.toContain("name: autofl");
    expect(content).not.toContain("automated fault-localization");
    expect(openFile).toHaveBeenCalledWith(
      "file:///workspace/.continue/agents/new-config.yaml",
    );
  });
});
