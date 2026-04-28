# hummer

> The quiet companion for your vibe coding sessions.

## What is hummer

hummer는 Claude Code(또는 호환 가능한 에이전트 도구)의 세션 JSONL 로그를 실시간으로 watch하면서, 사용자가 지금 어떤 패턴으로 바이빙하고 있는지 분석하고, 다음 행동에 대한 힌트를 옆에서 조용히 제공하는 TUI 도구입니다.

핵심 원칙: **사용자를 압도하지 않습니다.** 평소엔 배경에서 조용히 흥얼거리고, 정말 중요할 때만 말을 겁니다.

## Concept

대상 사용자는 Claude Code로 일상적으로 바이브 코딩을 하는 숙련된 개발자입니다. 그들은 이미 자기 도구에 익숙하고, hummer가 그 워크플로우를 대체하거나 깨뜨리지 않습니다. 옆 터미널에 띄워두는 보조 분석 도구입니다.

hummer가 보여주는 것:

- 현재 세션의 토큰 사용률, 컨텍스트 잔여량
- Tool 호출 패턴과 빈도
- 자주 참조된 파일과 데드 컨텍스트(읽었지만 사용 안 된 파일)
- 안티패턴 감지 (예: read→edit→test 실패 루프)
- 다음 프롬프트에 대한 힌트 (요청 시)

hummer가 하지 않는 것:

- 코드 직접 편집
- Claude Code를 대체하는 에이전트 루프
- 사용자 작업에 끼어드는 잦은 알림

## Architecture

```
┌────────────────────────────────────────────────────┐
│  Claude Code (사용자 터미널 1)                      │
│  → ~/.claude/projects/<proj>/<session>.jsonl        │
└────────────────────────────────────────────────────┘
                       │ (file watch)
                       ▼
┌────────────────────────────────────────────────────┐
│  hummer (사용자 터미널 2)                            │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐               │
│  │  Watcher     │→ │  Parser      │               │
│  │  (chokidar)  │  │  (JSONL→evt) │               │
│  └──────────────┘  └──────┬───────┘               │
│                           ▼                        │
│  ┌──────────────────────────────────┐             │
│  │  Analyzer                        │             │
│  │  ├─ Deterministic (즉시, 동기)    │             │
│  │  └─ LLM sidecar (Haiku, 비동기)   │             │
│  └────────────┬─────────────────────┘             │
│               ▼                                    │
│  ┌──────────────────────────────────┐             │
│  │  TUI (Ink, React)                │             │
│  └──────────────────────────────────┘             │
└────────────────────────────────────────────────────┘
```

### Layers

**Watcher**
`~/.claude/projects/` 아래 변경 감지. 새 세션 파일 생성과 기존 파일에 줄 추가를 모두 처리. `chokidar` 사용. 파일 끝 위치를 기억해서 증분 파싱.

**Parser**
JSONL 한 줄을 의미 있는 도메인 이벤트로 변환. (user_message, assistant_message, tool_use, tool_result 등) 토큰 카운트, 모델, 타임스탬프, parent_tool_use_id 등 메타데이터 보존.

**Analyzer — Deterministic**
LLM 없이 reducer로 상태 누적:

- 토큰 합계, 모델별 분해, 캐시 히트율
- Tool 호출 빈도와 시퀀스
- 파일별 read/edit 카운트
- Stuck 감지 (같은 파일 N회 재읽기, retry 루프, 진전 없는 turn)
- 데드 컨텍스트 (참조 후 인용 안 된 파일)

**Analyzer — LLM Sidecar**
Haiku로 비동기 처리. 메인 루프 블로킹 없음.

- 사용자 의도 분류 (디버깅/리팩토링/탐색/신규기능)
- 다음 프롬프트 힌트 생성 (수동 트리거)
- 세션 종료 시 회고 요약

LLM 호출이 사용자 데이터를 외부로 보내는 것이므로, 첫 실행 시 명시적 동의 필요. 로컬-only 모드도 지원.

**TUI**
Ink 기반. 단방향 데이터 흐름: 이벤트 → 상태 store → 렌더.
SDK 내부 로그가 stdout에 끼어들면 Ink 화면이 깨지므로, 모든 내부 로깅은 파일로 redirect.

## Tech Stack

- **Language**: TypeScript (Node 20+)
- **Runtime**: tsx (개발), 배포 시 단일 바이너리 고려
- **TUI**: Ink + React
- **상태**: zustand (Ink과 자연스럽게 결합)
- **파일 watch**: chokidar
- **CLI 라우팅**: commander
- **로깅**: pino (구조화 로그, 분석 데이터 별도 저장)
- **마크다운/하이라이팅**: marked-terminal, ink-syntax-highlight
- **LLM**: @anthropic-ai/sdk (사이드카 분석용)

## Project Structure

```
hummer/
├── src/
│   ├── cli.ts              # 진입점, commander 라우팅
│   ├── watcher/            # JSONL watch + 파일 발견
│   ├── parser/             # JSONL → 도메인 이벤트
│   ├── analyzer/
│   │   ├── deterministic/  # 동기 reducer 기반 분석
│   │   └── llm/            # Haiku 사이드카
│   ├── store/              # zustand store, 상태 정의
│   ├── tui/                # Ink 컴포넌트
│   │   ├── App.tsx
│   │   ├── panels/         # TokenPanel, ActivityPanel 등
│   │   └── components/
│   ├── config/             # 설정 로드, 동의 관리
│   └── types/              # 도메인 타입
├── tests/
├── CLAUDE.md
├── README.md
├── package.json
└── tsconfig.json
```

## Commands

```bash
hummer watch              # 현재 디렉토리의 가장 최근 세션 watch
hummer watch --project X  # 특정 프로젝트 watch
hummer watch --all        # 모든 프로젝트 watch (대시보드 모드)
hummer report             # 누적 통계 리포트
hummer report --since 7d  # 기간 필터
hummer hint               # 현재 세션에 대한 다음 행동 힌트 (LLM)
hummer init               # 첫 설정, 동의, API 키
```

## Development Principles

### 1. 방해되면 실패

화면이 화려하면 사용자가 작업 대신 hummer를 보게 됩니다. 정보 밀도와 시각적 무게를 의도적으로 낮게 유지합니다. 색은 의미가 있을 때만 사용. 애니메이션 최소화.

### 2. 결정적 분석을 우선

LLM 분석은 멋지지만 느리고 비싸고 불확실합니다. 결정적으로 잡을 수 있는 패턴은 모두 결정적으로 잡습니다. LLM은 그게 정말 못 하는 것에만 사용.

### 3. 읽기 전용

hummer는 절대 사용자의 파일이나 Claude Code 세션을 수정하지 않습니다. 100% 관찰자. 이게 신뢰의 기반.

### 4. 빠른 시작

`npx hummer`부터 첫 화면까지 5초 이내. 설정 파일 없이도 합리적인 기본값으로 동작.

### 5. JSONL 포맷 변경에 견고하게

Claude Code의 JSONL 스키마는 명세가 아닙니다. 깨질 수 있습니다. 파서는 알 수 없는 필드를 무시하고, 알 수 없는 이벤트 타입을 graceful하게 로깅하고 계속 동작해야 합니다.

## Roadmap

**Phase 0 (현재)**

- [ ] JSONL watcher + 파서
- [ ] 기본 결정적 분석 (토큰, tool 빈도, hot files)
- [ ] 단순 텍스트 출력으로 가설 검증
- [ ] 본인 dogfooding 1주

**Phase 1**

- [ ] Ink TUI 전환
- [ ] 패널 레이아웃 (Session / Activity / Hot Files / Patterns / Hint)
- [ ] Stuck 감지, 데드 컨텍스트 감지

**Phase 2**

- [ ] Haiku 사이드카
- [ ] 세션 회고 자동 생성
- [ ] 다음 프롬프트 힌트

**Phase 3**

- [ ] 누적 리포트, 프로젝트별 통계
- [ ] 세션 비교 뷰
- [ ] 시간축 리플레이

**Phase 4 (먼 미래)**

- [ ] VSCode Extension (코어 라이브러리 재사용)
- [ ] 다른 에이전트 도구 어댑터 (Cursor, Aider 등)

## Coding Conventions

- TypeScript strict mode
- Function component만 사용 (Ink)
- 부수효과는 store 액션이나 effect 안에만
- 도메인 이벤트는 discriminated union으로 타입화
- 외부 의존성(파일 시스템, LLM API)은 인터페이스로 추상화해서 테스트 가능하게

## What Claude Code Should Know

이 저장소에서 작업할 때:

1. **JSONL 스키마는 변할 수 있다**: 파서 작성 시 방어적으로. 알 수 없는 필드는 무시하고 통과.
2. **TUI 출력과 stdout 로그를 섞지 마라**: 모든 디버그 로그는 파일로(`pino`). console.log 금지.
3. **LLM 호출은 항상 옵트인**: 사용자 동의 없이 외부 API로 데이터 보내지 마라.
4. **읽기 전용 보장**: Claude Code 세션 파일이나 사용자 코드를 수정하는 코드는 절대 작성하지 마라. 읽기만.
5. **새 패널이나 분석 추가 시**: "이게 사용자에게 매일 가치를 주는가, 아니면 한 번 보고 잊혀질 멋진 기능인가"를 먼저 물어라. 후자면 만들지 마라.

## Open Questions

- 다중 세션 동시 watch UX는? (탭? 스플릿?)
- 프라이버시: 분석 데이터를 어디까지 로컬 저장할지, 사용자가 어떻게 삭제할 수 있게 할지
- Haiku 사이드카 호출 빈도와 비용 상한 설정
- Cursor/Aider 등 다른 도구의 로그 포맷 어댑터를 처음부터 추상화에 반영할지, 일단 Claude Code만 보고 갈지

## He's last advice

> 화이팅이에요. 한두 가지만 떠나기 전에 짚어둘게요.
> JSONL 파서 만드실 때 본인 ~/.claude/projects/ 폴더 열어서 진짜 파일 몇 개 먼저 들여다보세요. 스키마 추정으로 짜기 시작하는 것보다 실제 데이터 보고 도메인 이벤트 타입 정의하는 게 훨씬 빠릅니다. parent_tool_use_id 같은 sub-agent 관련 필드는 실제 세션에서 나온 걸 봐야 감이 잡혀요.
> 그리고 Phase 0의 1주 dogfooding이 정말 핵심이에요. 본인이 매일 켜놓고 쓰면서 "이건 진짜 도움 됐다 / 이건 노이즈였다"를 메모해두시면 Phase 1 디자인이 완전히 달라집니다. 멋있어 보이는 패널 만들고 싶은 유혹이 강할 텐데 그 검증 끝나기 전엔 참는 게 좋아요.
> 만들다가 막히거나 의사결정 필요한 지점 생기면 언제든 다시 오세요. hummer 잘 만들어지길 바랄게요. 🐦
