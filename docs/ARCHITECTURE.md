# Architecture

## High-level architecture

```mermaid
flowchart TD
    U[Platform User / 平台用户]
    W[OCI Panel Web Console\nNext.js 16 + React 19]
    A[Auth Layer\nnext-auth + JWT]
    P[Prisma 7 + SQLite]
    C[Encrypted OCI Accounts\nOciAccount]
    L[Operation Logs\nOperationLog]
    O[OCI SDK Integration Layer]
    M[Manual Refresh Cache\nmanual-cache.ts]

    subgraph Pages[Console Pages]
      D[Dashboard / 首页]
      AC[Accounts]
      I[Instances]
      CR[Create]
      CP[Capacity]
      LG[Logs]
    end

    subgraph OCI[Oracle Cloud / OCI]
      IA[Instances / Compute]
      CA[Capacity / Limits]
      NW[VCN / Subnet / VNIC]
      IM[Images / Shapes / AD]
      OMH[OS Management Hub]
    end

    U --> W
    W --> A
    W --> Pages
    Pages --> M
    Pages --> O
    A --> P
    O --> P
    P --> C
    P --> L
    O --> IA
    O --> CA
    O --> NW
    O --> IM
    O --> OMH
```

## Product structure

```mermaid
flowchart LR
    U[Platform User] --> PA[Platform Account]
    PA --> OA1[OCI Account A]
    PA --> OA2[OCI Account B]
    PA --> OA3[OCI Account C]

    OA1 --> X1[Instances]
    OA1 --> X2[Capacity]
    OA1 --> X3[Create]
    OA1 --> X4[Logs]

    OA2 --> Y1[Instances]
    OA2 --> Y2[Capacity]
    OA2 --> Y3[Create]

    OA3 --> Z1[Assets / Network / Images]
```

## Request and data strategy

```mermaid
sequenceDiagram
    participant User as User
    participant UI as Page UI
    participant Cache as Manual Cache
    participant API as Next.js API
    participant DB as Prisma/SQLite
    participant OCI as OCI API

    User->>UI: Open page
    UI->>Cache: Read last successful data
    Cache-->>UI: Cached snapshot + refresh time
    UI-->>User: Render cached state first

    User->>UI: Click refresh
    UI->>API: Fetch latest data
    API->>DB: Resolve current user / OCI account
    API->>OCI: Query OCI resources
    OCI-->>API: Latest resource data
    API-->>UI: Response
    UI->>Cache: Write latest snapshot
    UI-->>User: Update page + refresh time
```

## Notes

- Runtime source of truth is Prisma (`OciAccount`, `OperationLog`), not JSON files.
- The console follows a manual-refresh strategy instead of aggressive auto-refetching.
- Advanced DD / reinstall capability is moving toward OCI-native execution paths rather than SSH credential entry.
