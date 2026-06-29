import { EditorView, Key, WebView } from "vscode-extension-tester";

import { GUIActions } from "../actions/GUI.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

const REAL_MODEL_TITLE = process.env.E2E_REAL_MODEL_TITLE;

describe("AutoFL slash command with real OpenAI model", () => {
  let view: WebView | undefined;

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    if (!REAL_MODEL_TITLE) {
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

  it("gets an AutoFL response through OpenAI", async function () {
    this.timeout(DEFAULT_TIMEOUT.XXLP);

    const [messageInput] = await GUISelectors.getMessageInputFields(view!);

    await messageInput.sendKeys("/autofl");
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);
    await messageInput.sendKeys(Key.TAB);
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);
    await messageInput.sendKeys(
      "python -c \"import sys; sys.stderr.write('AUTOFL_REAL_FAILURE test_math_utils.py AssertionError assert -1 == 5'); sys.exit(1)\"",
    );
    await messageInput.sendKeys(Key.ENTER);

    await TestUtils.waitForSuccess(
      () => GUISelectors.getThreadMessageByText(view!, "AUTOFL_REAL_FAILURE"),
      DEFAULT_TIMEOUT.XXLP,
    );
    await TestUtils.waitForSuccess(
      () =>
        GUISelectors.getThreadMessageByText(
          view!,
          "AutoFL이 터미널 출력을 캡처했습니다",
        ),
      DEFAULT_TIMEOUT.XL,
    );
  });
});
