import { EditorView, Key, WebView } from "vscode-extension-tester";

import { GlobalActions } from "../actions/Global.actions";
import { GUIActions } from "../actions/GUI.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

describe("AutoFL slash command", () => {
  let view: WebView;

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GlobalActions.openTestWorkspace();
    await GlobalActions.clearAllNotifications();
  });

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GUIActions.toggleGui();
    ({ view } = await GUIActions.switchToReactIframe());
    await GUIActions.selectModelFromDropdown(view, "LAST MESSAGE MOCK LLM");
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  it("runs /autofl as a built-in test execution command", async function () {
    this.timeout(DEFAULT_TIMEOUT.XXLP);

    const [messageInput] = await GUISelectors.getMessageInputFields(view);

    await messageInput.sendKeys("/autofl");
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);
    await messageInput.sendKeys(Key.TAB);
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);
    await messageInput.sendKeys(
      "python -m unittest -q autofl_failure_test.AutoFLFailureTest.test_autofl_e2e_failure",
    );
    await messageInput.sendKeys(Key.ENTER);

    await TestUtils.waitForSuccess(
      () =>
        GUISelectors.getThreadMessageByText(
          view,
          "AutoFL이 테스트 명령을 실행합니다",
        ),
      DEFAULT_TIMEOUT.XL,
    );
    await TestUtils.waitForSuccess(
      () => GUISelectors.getThreadMessageByText(view, "AUTOFL_E2E_FAILURE"),
      DEFAULT_TIMEOUT.XXLP,
    );
    await TestUtils.waitForSuccess(
      () =>
        GUISelectors.getThreadMessageByText(
          view,
          "AutoFL executed this test command itself",
        ),
      DEFAULT_TIMEOUT.XXLP,
    );

    await TestUtils.expectNoElement(
      () => GUISelectors.getThreadMessageByText(view, "{{{ input }}}"),
      DEFAULT_TIMEOUT.XS,
    );
  });
});
