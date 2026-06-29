import { describe, expect, it } from "vitest";

import { AUTOFL_ANALYSIS_PROMPT } from "./prompts";
import { defaultConfigYaml, defaultConfigYamlJetBrains } from "./yaml/default";

describe("AutoFL slash command prompt", () => {
  it("is not copied into default YAML prompt blocks", () => {
    expect(defaultConfigYaml.prompts).toEqual([]);
    expect(defaultConfigYamlJetBrains.prompts).toEqual([]);
  });

  it("describes AutoFL as a command-executing analyzer", () => {
    expect(AUTOFL_ANALYSIS_PROMPT).toContain("AutoFL has executed itself");
    expect(AUTOFL_ANALYSIS_PROMPT).toContain("executed test command");
    expect(AUTOFL_ANALYSIS_PROMPT).toContain(
      "Do not treat user-pasted logs as equivalent",
    );
    expect(AUTOFL_ANALYSIS_PROMPT).toContain(
      "Do not require the user to provide report-format instructions",
    );
    expect(AUTOFL_ANALYSIS_PROMPT).toContain("Answer in Korean by default");
  });
});
