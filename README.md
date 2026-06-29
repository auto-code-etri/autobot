<h1 align="center">Autobot</h1>

<p align="center">ETRI에서 공개한 Visual Studio Code용 오픈소스 AI 코드 에이전트</p>

<div align="center">

<a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" /></a>
<a href="https://github.com/auto-code-etri/autobot"><img src="https://img.shields.io/badge/Repository-auto--code--etri%2Fautobot-blue" /></a>

</div>

<p align="center">
  <img src="extensions/vscode/media/readme.png" alt="ETRI Autobot logo" />
</p>

## 개요

Autobot은 ETRI에서 공개하고 유지하는 Visual Studio Code용 오픈소스 AI 코드 에이전트입니다. Apache-2.0 라이선스로 공개된 Continue v2.0.0 코드베이스를 기반으로 합니다.

Autobot은 기존 Continue 설정과 내부 확장 구조의 호환성을 필요한 범위에서 유지하면서, 사용자가 제품을 Autobot으로 인지할 수 있도록 ETRI 브랜드 경험과 AutoFL 중심의 결함 위치 추정 워크플로우를 제공합니다.

## 주요 기능

- VS Code 안에서 AI 기반 채팅, 코드 편집, 자동완성, 에이전트 워크플로우 제공
- 실패한 테스트 명령을 기반으로 결함 위치를 추정하는 `/autofl` 슬래시 명령 제공
- 기존 Continue 설정 파일과 내부 command/config namespace 호환성 유지
- Apache-2.0 라이선스 기반 공개 배포 및 upstream Continue 저작권 고지 유지

## VS Code 확장

Autobot VS Code 확장은 `extensions/vscode`에서 빌드되고 배포됩니다.

- 공개 확장 ID: `ETRI.autobot`
- 사용자에게 표시되는 제품명: `Autobot`
- 호환성 namespace: 기존 `continue.*` command와 설정은 의도적으로 유지됩니다

## AutoFL

AutoFL은 Autobot의 첫 번째 공개 기능 트랙입니다. `/autofl` 명령은 사용자가 입력한 실패 테스트 명령을 직접 실행하고, stdout, stderr, stack frame source snippet을 수집한 뒤 해당 근거를 바탕으로 결함 위치 추정을 지원합니다.

자세한 사용 방법은 [AutoFL 사용 가이드](docs/autofl.md)를 참고하세요.

## 라이선스 및 출처

Autobot은 Apache-2.0 라이선스로 배포됩니다.

Autobot은 Apache-2.0 라이선스의 Continue v2.0.0 코드베이스에서 파생되었습니다. 원본 Continue의 저작권 및 라이선스 고지는 이 저장소에 보존됩니다.
