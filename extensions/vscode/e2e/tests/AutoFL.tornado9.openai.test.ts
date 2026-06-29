import * as fs from "fs";

import { By, EditorView, Key, WebView } from "vscode-extension-tester";

import { GUIActions } from "../actions/GUI.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

const REAL_MODEL_TITLE = process.env.E2E_REAL_MODEL_TITLE;
const PROMPT_FILE = process.env.E2E_AUTOFL_TORNADO9_PROMPT_FILE;
const RESULT_FILE = process.env.E2E_AUTOFL_TORNADO9_RESULT_FILE;
const REAL_MODEL_TIMEOUT = Number(
  process.env.E2E_AUTOFL_REAL_TIMEOUT_MS ?? DEFAULT_TIMEOUT.XXLP,
);
const REQUIRE_SKILL_MARKER =
  process.env.E2E_AUTOFL_REQUIRE_SKILL_MARKER === "1";

async function getThreadMessages(view: WebView): Promise<string[]> {
  const messages = await view.findWebElements(By.className("thread-message"));
  const textParts = [];
  for (const message of messages) {
    textParts.push(await message.getText());
  }
  return textParts;
}

async function writeThreadSnapshot(view: WebView): Promise<string[]> {
  const messages = await getThreadMessages(view);
  const output = messages.join("\n\n--- MESSAGE ---\n\n");
  fs.writeFileSync(RESULT_FILE!, output);
  return messages;
}

function hasCompletedLocalization(messages: string[]): boolean {
  if (messages.length < 3) {
    return false;
  }

  const lastMessage = messages[messages.length - 1] ?? "";
  if (
    lastMessage.includes("AutoFL이 테스트 명령을 실행합니다") ||
    lastMessage.includes("AutoFL이 터미널 출력을 캡처했습니다")
  ) {
    return false;
  }

  const hasBugLocation =
    lastMessage.includes("tornado/httputil.py") ||
    lastMessage.includes("tornado\\httputil.py");
  const hasFunction = lastMessage.includes("url_concat");
  const hasRequestedCompletion =
    lastMessage.includes("AUTOFL_TORNADO9_DONE") ||
    (hasBugLocation && hasFunction);
  const hasRequiredSkillMarker =
    !REQUIRE_SKILL_MARKER || lastMessage.includes("AUTOFL_SKILL_GUIDANCE_USED");

  return (
    hasRequestedCompletion &&
    hasBugLocation &&
    hasFunction &&
    hasRequiredSkillMarker
  );
}

describe("AutoFL tornado9 real localization", () => {
  let view: WebView | undefined;

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    if (!REAL_MODEL_TITLE || !PROMPT_FILE || !RESULT_FILE) {
      this.skip();
    }

    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.SM);
  });

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GUIActions.toggleGui();
    ({ view } = await GUIActions.switchToReactIframe());
    await GUIActions.selectModelFromDropdown(view, REAL_MODEL_TITLE!);
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    if (view) {
      await view.switchBack();
    }
    await new EditorView().closeAllEditors();
  });

  it("ranks the known tornado9 bug location", async function () {
    this.timeout(REAL_MODEL_TIMEOUT);

    const prompt = fs.readFileSync(PROMPT_FILE!, "utf8");
    const [messageInput] = await GUISelectors.getMessageInputFields(view!);

    await messageInput.sendKeys("/autofl");
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);
    await messageInput.sendKeys(Key.TAB);
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);
    await messageInput.sendKeys(prompt);
    await messageInput.sendKeys(Key.ENTER);

    await TestUtils.waitForSuccess(
      async () => {
        const messages = await writeThreadSnapshot(view!);
        const output = messages.join("\n\n--- MESSAGE ---\n\n");
        if (!output.includes("AutoFL이 터미널 출력을 캡처했습니다")) {
          throw new Error("AutoFL has not captured terminal output yet");
        }
        if (!hasCompletedLocalization(messages)) {
          throw new Error("AutoFL final localization is not complete yet");
        }
        return output;
      },
      REAL_MODEL_TIMEOUT,
      2_000,
    );

    const output = fs.readFileSync(RESULT_FILE!, "utf8");

    if (
      !output.includes("tornado/httputil.py") &&
      !output.includes("tornado\\httputil.py")
    ) {
      throw new Error("AutoFL output did not mention tornado/httputil.py");
    }
    if (!output.includes("url_concat")) {
      throw new Error("AutoFL output did not mention url_concat");
    }
    if (
      REQUIRE_SKILL_MARKER &&
      !output.includes("AUTOFL_SKILL_GUIDANCE_USED")
    ) {
      throw new Error("AutoFL output did not confirm skill guidance usage");
    }
  });
});
