# Claude Code JSONL Schema

`~/.claude/projects/<project>/<session>.jsonl` 파일의 구조 분석.  
`data/example.jsonl` (1668줄) 기반.

---

## Entry Types 분포

| type | 줄 수 | 설명 |
|------|-------|------|
| `progress` | 518 | hook/agent 진행 상황 이벤트 |
| `assistant` | 415 | Claude 응답 (스트리밍 청크 포함) |
| `user` | 329 | 사용자 메시지 + tool_result |
| `queue-operation` | 244 | 내부 큐 enqueue/dequeue |
| `file-history-snapshot` | 160 | 파일 백업 스냅샷 |
| `ai-title` | 1 | AI가 생성한 세션 제목 |
| `last-prompt` | 1 | 마지막 프롬프트 |

파싱에서 의미있는 타입은 `user`와 `assistant`만. 나머지는 무시.

---

## `user` 엔트리

```jsonc
{
  "type": "user",
  "uuid": "c1cf1c2b-...",           // 이 엔트리의 고유 ID
  "parentUuid": "...",              // 이전 엔트리 UUID (null이면 세션 시작)
  "promptId": "f6f9c2db-...",       // 하나의 사용자 입력 단위
  "isSidechain": false,
  "sessionId": "3d7d60ee-...",
  "timestamp": "2026-03-25T05:15:51.759Z",
  "cwd": "/Users/.../project",
  "version": "2.1.81",
  "gitBranch": "HEAD",
  "permissionMode": "acceptEdits",
  "userType": "external",
  "entrypoint": "claude-vscode",    // "claude-vscode" | "claude" 등
  "message": {
    "role": "user",
    "content": [
      { "type": "text", "text": "사용자가 입력한 텍스트" },

      // tool 결과를 돌려줄 때
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01BSs...",
        "content": "파일 내용 또는 stdout"
      }
    ]
  },

  // tool_result인 경우 추가 필드
  "toolUseResult": {
    "type": "text",
    "stdout": "...",
    "stderr": "",
    "interrupted": false
  },
  "sourceToolAssistantUUID": "..."   // 어떤 assistant 엔트리가 이 tool을 요청했는지
}
```

**content는 string일 수도 있고 배열일 수도 있다.** 방어적으로 처리 필요.

---

## `assistant` 엔트리

### 스트리밍 구조

같은 `message.id`를 가진 엔트리가 여러 줄 나온다.

- `stop_reason: null` — 스트리밍 중간 청크
- `stop_reason: "end_turn"` — 텍스트 응답 완료
- `stop_reason: "tool_use"` — tool 호출로 종료

**→ 파싱 시 `stop_reason !== null`인 마지막 엔트리만 사용.**

분포: 415줄 중 `null` 104줄, `end_turn` 103줄, `tool_use` 208줄.  
unique message.id 318개 중 74개가 중복(스트리밍 청크).

```jsonc
{
  "type": "assistant",
  "uuid": "5364ea4f-...",
  "parentUuid": "c1cf1c2b-...",
  "isSidechain": false,
  "requestId": "req_011C...",
  "sessionId": "3d7d60ee-...",
  "timestamp": "2026-03-25T05:15:56.452Z",
  "cwd": "/Users/.../project",
  "version": "2.1.81",
  "gitBranch": "HEAD",
  "slug": "dapper-doodling-candy",   // 세션 슬러그 (중간부터 생김)
  "message": {
    "id": "msg_012p...",             // 스트리밍 청크 간 공유되는 ID
    "model": "claude-sonnet-4-6",
    "role": "assistant",
    "type": "message",
    "stop_reason": "end_turn",       // null | "end_turn" | "tool_use"
    "stop_sequence": null,
    "content": [
      { "type": "thinking", "thinking": "...", "signature": "..." },
      { "type": "text", "text": "응답 텍스트" },
      {
        "type": "tool_use",
        "id": "toolu_01BSs...",
        "name": "Read",              // Bash | Read | Edit | Write | Glob | Agent
        "input": { "file_path": "..." },
        "caller": { "type": "direct" }
      }
    ],
    "usage": {
      "input_tokens": 3,
      "output_tokens": 244,
      "cache_creation_input_tokens": 9612,
      "cache_read_input_tokens": 6342,
      "cache_creation": {
        "ephemeral_5m_input_tokens": 0,
        "ephemeral_1h_input_tokens": 9612
      },
      "server_tool_use": {
        "web_search_requests": 0,
        "web_fetch_requests": 0
      },
      "service_tier": "standard",
      "speed": "standard"
    }
  }
}
```

### content 타입

| type | 설명 |
|------|------|
| `text` | 텍스트 응답 |
| `thinking` | extended thinking 블록 |
| `tool_use` | tool 호출 |

### tool 종류 (example 기준)

`Agent`, `Bash`, `Edit`, `Glob`, `Read`, `Write`

---

## `progress` 엔트리

`data.type`에 따라 두 종류로 나뉜다.

### hook_progress

tool 호출 전후로 실행되는 hook의 진행 상황.

```jsonc
{
  "type": "progress",
  "uuid": "b9b2b698-...",
  "parentUuid": "74613479-...",
  "isSidechain": false,
  "toolUseID": "toolu_01BSs...",
  "parentToolUseID": "toolu_01BSs...",
  "sessionId": "3d7d60ee-...",
  "timestamp": "2026-03-25T05:15:57.409Z",
  "data": {
    "type": "hook_progress",
    "hookEvent": "PreToolUse",        // "PreToolUse" | "PostToolUse"
    "hookName": "PreToolUse:Read",
    "command": "callback"
  }
}
```

### agent_progress

서브에이전트(Agent tool) 실행 중 내부 메시지 흐름.

```jsonc
{
  "type": "progress",
  "uuid": "637a35b1-...",
  "parentUuid": "527bd128-...",
  "isSidechain": false,
  "toolUseID": "agent_msg_01VF...",
  "parentToolUseID": "toolu_01G1...",
  "sessionId": "3d7d60ee-...",
  "timestamp": "2026-03-25T05:46:03.833Z",
  "data": {
    "type": "agent_progress",
    "agentId": "a597823f74dca16cc",
    "prompt": "Search the web for...",
    "message": {
      "type": "user",
      "message": { "role": "user", "content": [...] },
      "uuid": "7003cb9d-...",
      "timestamp": "..."
    }
  }
}
```

---

## `queue-operation` 엔트리

```jsonc
{
  "type": "queue-operation",
  "operation": "enqueue",   // "enqueue" | "dequeue"
  "timestamp": "2026-03-25T05:15:51.748Z",
  "sessionId": "3d7d60ee-..."
}
```

---

## `file-history-snapshot` 엔트리

```jsonc
{
  "type": "file-history-snapshot",
  "messageId": "c1cf1c2b-...",
  "isSnapshotUpdate": false,
  "snapshot": {
    "messageId": "c1cf1c2b-...",
    "trackedFileBackups": {},   // 수정된 파일이 있으면 여기에 백업 내용
    "timestamp": "2026-03-25T05:15:51.760Z"
  }
}
```

---

## `ai-title` 엔트리

```jsonc
{
  "type": "ai-title",
  "sessionId": "3d7d60ee-...",
  "aiTitle": "Design system platform MVP scope planning"
}
```

---

## `last-prompt` 엔트리

```jsonc
{
  "type": "last-prompt",
  "sessionId": "3d7d60ee-...",
  "lastPrompt": "그리고 자꾸 자동으로 커밋하지 마"
}
```

---

## 파서 관점에서 무시해도 되는 타입들

| type | 이유 |
|------|------|
| `queue-operation` | 내부 처리용, 분석 가치 없음 |
| `file-history-snapshot` | undo 파일 백업 |
| `progress` | hook/agent 진행 상황, 메인 흐름과 별개 |
| `ai-title` | 세션 제목 (필요하면 읽어도 됨) |
| `last-prompt` | 마지막 프롬프트 캐시 |

---

## 파서가 다뤄야 할 핵심 패턴

1. **스트리밍 청크 dedup** — `message.id` + `stop_reason !== null`으로 최종본만
2. **content 타입 분기** — string vs array, text vs tool_use vs tool_result
3. **tool 흐름 추적** — `tool_use.id` → `tool_result.tool_use_id`로 요청-결과 연결
4. **알 수 없는 필드 무시** — 스키마는 변할 수 있으므로 방어적 파싱
