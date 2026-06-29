# AutoFL 사용 가이드

AutoFL은 Autobot의 built-in slash command입니다. 사용자가 실패 테스트를 재현하는 명령을 입력하면 Autobot이 해당 명령을 직접 실행하고, 실행 결과와 stack frame source snippet을 근거로 결함 위치를 추정합니다.

## 언제 사용하나

- 실패하는 단일 테스트 또는 좁은 테스트 범위가 있을 때
- 실패 로그만 읽는 것이 아니라, Autobot이 테스트 명령을 직접 실행한 결과를 기준으로 분석하고 싶을 때
- 의심 파일, 함수, 메서드, 수정 후보 위치를 빠르게 좁히고 싶을 때

## 기본 사용법

Autobot 채팅 입력창에서 `/autofl` 뒤에 실패 테스트 명령을 입력합니다.

```text
/autofl <실패 테스트를 재현하는 명령>
```

예:

```text
/autofl pytest tests/test_example.py::test_failure
```

```text
/autofl python -m unittest -q package.test_module.TestCase.test_name
```

하위 디렉터리에서 테스트를 실행해야 하면 `cd`를 함께 입력할 수 있습니다.

```text
/autofl cd packages/server && pytest tests/test_api.py::test_error_case
```

## 지원하는 명령 예시

AutoFL은 테스트 실행 명령을 찾아 직접 실행합니다. 대표적으로 다음 형태를 사용할 수 있습니다.

- Python: `pytest`, `py.test`, `python -m pytest`, `python -m unittest`
- Node.js: `npm test`, `npm run test`, `pnpm test`, `yarn test`, `npx vitest`, `npx jest`, `npx mocha`, `bun test`
- Go: `go test`
- Rust: `cargo test`
- .NET: `dotnet test`
- Java/JVM: `mvn test`, `./mvnw test`, `gradle test`, `./gradlew test`
- Shell script: `bash run_test.sh`, `./run_test.sh`

## 답변 형식 지시하기

필요하면 명령 뒤에 `# autofl:` 또는 `// autofl:` 형식으로 보고서 형식을 지시할 수 있습니다.

```text
/autofl pytest tests/test_parser.py::test_empty_input # autofl: 한국어로 10줄 이내로 요약해줘
```

이 지시는 테스트 명령에는 포함되지 않고, 최종 분석 답변의 형식 지시로만 사용됩니다.

## AutoFL이 수행하는 일

1. 입력에서 실패 테스트 명령을 확정합니다.
2. Autobot이 해당 명령을 직접 실행합니다.
3. exit status, stdout, stderr를 캡처합니다.
4. 출력에 포함된 stack frame을 찾아 관련 source snippet을 읽습니다.
5. 실패 증상, 기대 동작, assertion message, exception type, stack frame, source snippet을 근거로 결함 위치 후보를 정리합니다.

기본 답변은 한국어로 작성됩니다. 사용자가 명시적으로 다른 언어를 요청한 경우에만 다른 언어로 답변합니다.

## 결과 해석

AutoFL의 답변은 보통 다음 정보를 포함합니다.

- 실행한 테스트 명령
- 테스트가 실패했는지 또는 실행 환경 문제로 실패했는지
- 실패 원인 요약
- 의심되는 파일, 함수, 메서드의 우선순위 목록
- 각 후보에 대한 근거와 confidence
- 다음 확인 단계 또는 최소 재현/검증 테스트

AutoFL이 제시하는 위치는 결함 위치 추정 결과입니다. 최종 수정 전에는 제안된 위치를 확인하고 테스트를 다시 실행해야 합니다.

## 좋은 입력 예시

가능하면 실패를 재현하는 가장 좁은 테스트 명령을 입력합니다.

```text
/autofl pytest tests/test_url.py::test_url_concat_none_params
```

```text
/autofl python -m unittest -q tornado.test.httputil_test.TestUrlConcat.test_url_concat_none_params
```

```text
/autofl npm test -- parser.test.ts -t "handles empty input"
```

## 피해야 할 입력

AutoFL은 사용자가 붙여넣은 로그만으로 결함 위치를 추정하는 기능이 아닙니다. 실제 검증에서는 실패 로그가 아니라 실행 가능한 테스트 명령을 입력해야 합니다.

피해야 할 예:

```text
/autofl 이 로그 보고 분석해줘: AssertionError ...
```

```text
/autofl 테스트가 실패했는데 왜 그런지 봐줘
```

명령이 모호하면 AutoFL은 실행할 테스트 명령을 확정하지 못했다고 안내하고, 다시 입력을 요청합니다.

## 명령 또는 환경 문제

테스트 명령을 실행하기 전에 환경 문제가 있으면 AutoFL은 결함 위치 추정을 하지 않고 문제를 알려줍니다.

예:

- 명령을 찾을 수 없음
- 작업 디렉터리를 찾을 수 없음
- 테스트 파일을 열 수 없음
- `pytest` 또는 테스트 runner가 설치되어 있지 않음

이 경우 먼저 로컬 터미널에서 테스트 명령이 실행되는지 확인한 뒤 같은 명령을 `/autofl`에 다시 입력합니다.

## 선택적 AutoFL skill guidance

워크스페이스에 `.continue/skills/autofl-fault-localization/SKILL.md`가 있으면 AutoFL은 해당 내용을 내부 분석 절차 보강용으로 읽을 수 있습니다.

이 파일은 사용자 입력을 대체하지 않습니다. `/autofl <test command>` 형태로 실행 가능한 실패 테스트 명령을 제공해야 합니다.

## 현재 범위

현재 AutoFL은 실패 테스트 실행, 터미널 출력 캡처, stack frame 기반 source snippet 수집, LLM 기반 결함 위치 추정을 수행하는 최소 공개형 runner입니다.

원본 AutoFL의 전체 coverage DB, function-call exploration, 대규모 benchmark automation을 모두 이식한 형태는 아닙니다.
