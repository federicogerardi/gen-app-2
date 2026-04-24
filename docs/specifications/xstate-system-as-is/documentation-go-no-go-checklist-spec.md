# Checklist di Conformita Automatizzabile (Go/No-Go)

Versione: 1.0
Data: 2026-04-24
Scope: blocco regressioni documentali su specifiche XState as-is

## 1. Obiettivo

Questa checklist definisce controlli documentali automatizzabili per prevenire drift tra:

- blueprint cross-cutting,
- machine specs atomiche,
- appendici tipizzate canoniche.

Ogni regola ha un criterio Go/No-Go e una verifica CLI eseguibile in CI.

## 2. Convenzioni Operative

- Esito `GO`: tutte le verifiche della regola passano.
- Esito `NO-GO`: almeno una verifica fallisce.
- Le verifiche usano `rg` (ripgrep) e shell POSIX.
- Base path atteso: root repository.

## 3. Regole Go/No-Go

| ID | Regola | Verifica automatica (esempio) | GO | NO-GO |
|---|---|---|---|---|
| DOC-001 | Il catalogo eventi usage usa naming interno actor-to-actor (`USAGE_GRANTED`, `USAGE_REJECTED`) | `rg -n "USAGE_GRANTED \| USAGE_REJECTED" docs/specifications/xstate-system-as-is/xstate-system-overview-and-domain-spec.md` | Match presente | Nessun match |
| DOC-002 | Nessun naming legacy usage nel catalogo eventi unificato | `rg -n "USAGE_OK|RATE_LIMITED|QUOTA_EXHAUSTED" docs/specifications/xstate-system-as-is/xstate-system-overview-and-domain-spec.md` | Nessun match | Almeno un match |
| DOC-003 | `usage-machine-spec` dichiara output coerenti con i tipi canonici | `rg -n "USAGE_GRANTED|USAGE_REJECTED" docs/specifications/xstate-system-as-is/usage-machine-spec.md` | Entrambi presenti | Manca uno dei due |
| DOC-004 | Evento `STREAM_TERMINATED_FAILURE` nello skeleton include `artifactId` | `rg -n "STREAM_TERMINATED_FAILURE.*artifactId" docs/specifications/xstate-system-as-is/xstate-v5-skeleton-spec.md` | Match presente | Nessun match |
| DOC-005 | Evento `PERSISTENCE_FINALIZE_FAILED` nello skeleton include `artifactId` | `rg -n "PERSISTENCE_FINALIZE_FAILED.*artifactId" docs/specifications/xstate-system-as-is/xstate-v5-skeleton-spec.md` | Match presente | Nessun match |
| DOC-006 | Il contratto actor envelope minimo resta invariato nei tipi shared | `rg -n "type: TType;|requestId: string;|sourceActor: TSource;|timestamp: IsoTimestamp;" docs/specifications/xstate-system-as-is/xstate-shared-types-contract-spec.md` | Tutti i campi trovati | Almeno un campo assente |
| DOC-007 | I tipi canonici includono eventi child stream/persistence principali | `rg -n "STREAM_SESSION_STARTED|STREAM_CHUNK_RECEIVED|STREAM_TERMINATED_SUCCESS|STREAM_TERMINATED_FAILURE|PERSISTENCE_FINALIZE_SUCCEEDED|PERSISTENCE_FINALIZE_FAILED" src/lib/types/xstate.ts` | Tutti i token trovati | Almeno un token assente |
| DOC-008 | Le regole XState v5 obbligatorie sono esplicitate nella spec topology | `rg -n "setup\(\)\.createMachine\(\)|createActor\(\)|reenter: true|always|getNextSnapshot|evitare side effect dentro .*assign" docs/specifications/xstate-system-as-is/xstate-actor-contracts-and-topology-spec.md` | Match per tutte le direttive | Direttive mancanti |
| DOC-009 | La checklist di equivalenza funzionale e presente | `rg -n "Checklist di Equivalenza Funzionale|Go/No-Go" docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md` | Match presente | Nessun match |
| DOC-010 | L'indice blueprint referenzia la checklist automatizzabile | `rg -n "documentation-go-no-go-checklist-spec.md" docs/specifications/xstate-system-as-is-spec.md` | Match presente | Nessun match |
| DOC-011 | La surface runtime auth e documentata e implementata nel runtime export | `rg -n "createAuthHttpRuntime|createDefaultSessionCookieRuntime|createDefaultPasswordHashRuntime" docs/specifications/xstate-system-as-is/api-persistence-and-runtime-contracts-spec.md src/lib/runtime/index.ts` | Tutti i token trovati | Almeno un token assente |
| DOC-012 | Il dispatcher Node unificato auth+generation e documentato e implementato | `rg -n "createNodeRuntimeRequestHandler|createNodeRuntimeServer|/generation/stream" docs/specifications/xstate-system-as-is/api-persistence-and-runtime-contracts-spec.md src/lib/runtime/index.ts src/lib/runtime/node-server.ts` | Tutti i token trovati | Almeno un token assente |

## 4. Gate Complessivo

Il gate documentale e `GO` solo se tutte le regole DOC-001..DOC-012 sono `GO`.

Formula:

$$
GO_{globale} = \bigwedge_{i=1}^{12} GO_{DOC-i}
$$

Se almeno una regola e `NO-GO`, la pipeline deve fallire.

## 5. Script CI di Riferimento (Bash)

```bash
#!/usr/bin/env bash
set -euo pipefail

fail=0

check_present() {
  local pattern="$1"
  local file="$2"
  if ! rg -n "$pattern" "$file" >/dev/null; then
    echo "NO-GO: pattern non trovato in $file -> $pattern"
    fail=1
  fi
}

check_absent() {
  local pattern="$1"
  local file="$2"
  if rg -n "$pattern" "$file" >/dev/null; then
    echo "NO-GO: pattern vietato trovato in $file -> $pattern"
    fail=1
  fi
}

check_present "USAGE_GRANTED \\| USAGE_REJECTED" "docs/specifications/xstate-system-as-is/xstate-system-overview-and-domain-spec.md"
check_absent "USAGE_OK|RATE_LIMITED|QUOTA_EXHAUSTED" "docs/specifications/xstate-system-as-is/xstate-system-overview-and-domain-spec.md"
check_present "USAGE_GRANTED|USAGE_REJECTED" "docs/specifications/xstate-system-as-is/usage-machine-spec.md"
check_present "STREAM_TERMINATED_FAILURE.*artifactId" "docs/specifications/xstate-system-as-is/xstate-v5-skeleton-spec.md"
check_present "PERSISTENCE_FINALIZE_FAILED.*artifactId" "docs/specifications/xstate-system-as-is/xstate-v5-skeleton-spec.md"
check_present "type: TType;" "docs/specifications/xstate-system-as-is/xstate-shared-types-contract-spec.md"
check_present "requestId: string;" "docs/specifications/xstate-system-as-is/xstate-shared-types-contract-spec.md"
check_present "sourceActor: TSource;" "docs/specifications/xstate-system-as-is/xstate-shared-types-contract-spec.md"
check_present "timestamp: IsoTimestamp;" "docs/specifications/xstate-system-as-is/xstate-shared-types-contract-spec.md"
check_present "STREAM_SESSION_STARTED|STREAM_CHUNK_RECEIVED|STREAM_TERMINATED_SUCCESS|STREAM_TERMINATED_FAILURE|PERSISTENCE_FINALIZE_SUCCEEDED|PERSISTENCE_FINALIZE_FAILED" "src/lib/types/xstate.ts"
check_present "setup\\(\\)\\.createMachine\\(\\)|createActor\\(\\)|reenter: true|always|getNextSnapshot|evitare side effect dentro .*assign" "docs/specifications/xstate-system-as-is/xstate-actor-contracts-and-topology-spec.md"
check_present "Checklist di Equivalenza Funzionale|Go/No-Go" "docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md"
check_present "documentation-go-no-go-checklist-spec.md" "docs/specifications/xstate-system-as-is-spec.md"
check_present "createAuthHttpRuntime|createDefaultSessionCookieRuntime|createDefaultPasswordHashRuntime" "docs/specifications/xstate-system-as-is/api-persistence-and-runtime-contracts-spec.md"
check_present "createAuthHttpRuntime|createDefaultSessionCookieRuntime|createDefaultPasswordHashRuntime" "src/lib/runtime/index.ts"
check_present "createNodeRuntimeRequestHandler|createNodeRuntimeServer|/generation/stream" "docs/specifications/xstate-system-as-is/api-persistence-and-runtime-contracts-spec.md"
check_present "createNodeRuntimeRequestHandler|createNodeRuntimeServer" "src/lib/runtime/index.ts"
check_present "createNodeRuntimeRequestHandler|createNodeRuntimeServer|/generation/stream" "src/lib/runtime/node-server.ts"

if [[ "$fail" -ne 0 ]]; then
  echo "\nEsito finale: NO-GO"
  exit 1
fi

echo "Esito finale: GO"
```

## 6. Raccomandazioni di Evoluzione

- Aggiungere una versione machine-readable (`yaml/json`) di questa checklist se la CI deve produrre report strutturati.
- Estendere con regole specifiche per nuovi actor/eventi quando si evolve il registry.
