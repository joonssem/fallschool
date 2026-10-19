---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

출처: https://github.com/mattpocock/skills/tree/main/skills/productivity/handoff (MIT, 2026-10-19 도입).

사용자가 인수인계를 요청할 때 적용한다. 기존 맵 수정은 Claude, 새 맵 제작은 Codex라는 기본 역할과 사용자가 별도로 지정한 담당을 반영한다. 다음 담당자에게 메시지를 보내거나 에이전트를 호출하는 권한을 부여하지 않는다.

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS (`$TMPDIR`, else `/tmp`; `%TEMP%` on Windows), unless the user specifies another location. Use a unique filename and report its absolute path.

Include the objective, next owner, changed files, decisions, commands actually run and their results, unresolved work, and the next concrete action. For maps, include the core play to preserve and distinguish automated rule/movement checks, teacher reports, and unverified screen/iPad/classroom behavior. Reference the map's canonical document and docs/55 index instead of duplicating permanent history. State uncommitted changes and unfinished checks explicitly.

Include a "suggested skills" section in the document, naming which skills the next agent should call the Skill tool for.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
