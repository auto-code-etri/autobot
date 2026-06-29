---
name: autofl-fault-localization
description: Use when working on AutoFL fault localization in a Continue/Autobot workspace, especially when handling /autofl, failing test commands, captured terminal logs, stack traces, source snippets, or validation cases such as BugsInPy/KAIST tornado9. This skill enforces that AutoFL must execute the test command itself and must not localize from user-pasted ground truth.
---

# AutoFL Fault Localization

## 핵심 규칙

AutoFL은 로그 분석 프롬프트가 아니라 실행 가능한 fault-localization 워크플로우로 다룹니다.

AutoFL은 사용자가 준 실패 테스트 명령을 직접 실행하고, stdout/stderr/exit status를 캡처하고, 관련 stack frame source snippet을 확인한 뒤, 선택된 모델에 fault localization을 요청해야 합니다.

사용자가 실패 로그, 정답 파일, dataset ground truth, target method를 입력으로 줬다는 이유만으로 AutoFL이 동작했다고 판단하지 않습니다.

최종 답변은 기본적으로 한국어로 작성합니다. 사용자가 명시적으로 다른 언어를 요청한 경우에만 해당 언어로 답합니다.

## 입력 규약

구체적인 실패 테스트 명령을 받습니다.

```text
python -m unittest -q tornado.test.httputil_test.TestUrlConcat.test_url_concat_none_params
```

사용자는 자연어를 섞어 요청할 수 있습니다.

```text
이 테스트로 AutoFL 돌려줘: python -m unittest -q tornado.test.httputil_test.TestUrlConcat.test_url_concat_none_params
```

출력 형식 지시는 허용하지만, 그 지시 안에 예상 버그 위치가 포함되면 검증 입력으로 보지 않습니다.

허용되는 추가 지시:

```text
# autofl: 한국어로 10줄 이내로 답하세요.
```

허용되지 않는 추가 지시:

```text
# autofl: The bug is in tornado/httputil.py url_concat.
```

## 워크플로우

1. 테스트 명령이 있는지 확인합니다.
2. 활성 workspace에서 테스트 명령을 실행합니다.
3. exit status, stdout, stderr를 캡처합니다.
4. 명령이 실행 환경 문제로 실패하면 localization하지 말고 올바른 테스트 명령을 다시 요청합니다.
5. 명령이 통과하면 실패 테스트 명령이 필요하다고 보고합니다.
6. 명령이 실패하면 stack frame의 파일 경로, line number, symbol을 추출합니다.
7. workspace 내부 파일에서만 source snippet을 읽습니다.
8. 선택된 Continue model에 의심 파일, symbol, method ranking을 요청합니다.
9. 실패 테스트에서 구현 동작까지의 causal chain을 설명합니다.

## 증거 규칙

주요 증거로 사용할 수 있는 항목:

- AutoFL이 실행한 명령
- 캡처한 터미널 출력
- 캡처한 출력의 stack trace frame
- stack-frame 파일에서 읽은 source snippet
- 기대 동작을 설명하는 주변 테스트

다음 항목은 사용자가 명시적으로 log-only 분석을 요청하지 않는 한 localization 증거로 사용하지 않습니다.

- 사용자가 붙여넣은 실패 로그
- dataset label
- known ground truth
- 이전 assistant 결론
- 이전의 잘못된 실행에서 생성된 test result file

## 출력 형식

최종 답변에는 다음을 간결하게 포함합니다.

1. 실행한 명령
2. 실패 요약
3. 의심 위치 ranking
4. 각 위치의 증거
5. confidence
6. 가장 작은 다음 검증 단계

의심 위치는 가능하면 다음 형태를 사용합니다.

```text
1. path/to/file.py :: function_or_method
   Confidence: high
   Evidence: ...
```

## 검증 기준

유효한 AutoFL 검증은 AutoFL 자신이 다음을 표시하거나 기록했음을 보여야 합니다.

- `AutoFL이 테스트 명령을 실행합니다`
- 정확한 테스트 명령
- `AutoFL이 터미널 출력을 캡처했습니다`
- 실패 stack trace
- 최종 ranking 위치

tornado9 검증 입력은 명령만 포함하거나 출력 형식 지시만 추가해야 합니다. 사용자 입력 안에 `tornado/httputil.py`, `url_concat`, dataset ground truth를 포함하면 안 됩니다.

## 범위

이 skill은 AutoFL 운영 절차를 설명합니다. `/autofl` built-in slash command를 대체하지 않습니다.

Slash command는 deterministic execution과 capture를 담당합니다. 이 skill은 모델이 AutoFL 동작을 추론할 때 쓰는 절차 지침입니다.
