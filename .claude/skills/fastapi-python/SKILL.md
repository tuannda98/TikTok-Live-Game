---
name: apw:fastapi-python
description: "Python/FastAPI coding standards — SOLID, OOP, DI, Pydantic, ABC interfaces, reST docstrings, exception handling, design patterns. TRIGGER when: writing or modifying Python files in FastAPI projects, or any Python backend code. DO NOT TRIGGER when: frontend code, shell scripts, or non-Python files."
auto_trigger: true
trigger_patterns:
  - "**/*.py"
  - "**/backend/**/*.py"
  - "**/libs/python/**/*.py"
license: MIT
---

# FastAPI & Python Coding Standards

Mandatory standards for all Python/FastAPI code. Apply when writing, reviewing, or modifying Python files.

## 1. Architecture: Repository → Service → Transport

```
Transport (API routes)  →  Service (business logic)  →  Repository (data access)
     ↓ Depends()              ↓ ABC interface              ↓ ABC interface
   thin handlers            injectable                    injectable
```

**Rules:**
- Route handlers MUST be thin — delegate to services via `Depends()`
- Services contain business logic, receive repositories via constructor DI
- Repositories handle all database queries
- NO business logic in route handlers or repositories

## 2. Use `Annotated` (MANDATORY)

Always use `Annotated` style for parameters and dependencies:

```python
from typing import Annotated
from fastapi import Depends, Path, Query

# Type aliases for reusability
CurrentUserDep = Annotated[User, Depends(get_current_user)]
DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]

@app.get("/items/{item_id}")
async def read_item(
    item_id: Annotated[int, Path(ge=1)],
    q: Annotated[str | None, Query(max_length=50)] = None,
    user: CurrentUserDep,
    db: DbSessionDep,
) -> ItemResponse:
    ...
```

**DO NOT** use default assignment style:

```python
# ❌ DO NOT DO THIS
async def read_item(item_id: int = Path(ge=1)):
    ...
```

See [references/annotated-patterns.md](references/annotated-patterns.md) for details.

## 3. Return Types (MANDATORY)

Always declare return types — used for validation, filtering, serialization:

```python
@app.get("/items/me")
async def get_item() -> Item:
    return Item(name="Plumbus")
```

Use `response_model` when return type differs from validation type:

```python
@app.get("/items/me", response_model=Item)
async def get_item() -> Any:
    return InternalItem(name="Foo", secret_key="hidden")  # secret_key filtered out
```

## 4. Async vs Sync

Use `async def` ONLY when all code inside uses `await`. Default to `def`:

```python
# ✅ Async — awaited call
@app.get("/async/")
async def read_async():
    return await some_async_lib.fetch()

# ✅ Sync — blocking call (runs in threadpool)
@app.get("/sync/")
def read_sync():
    return blocking_lib.fetch()
```

**NEVER** run blocking code inside `async def` — damages performance.

See [references/async-sync-rules.md](references/async-sync-rules.md) for mixing patterns.

## 5. Router Configuration

Set prefix/tags on router, not in `include_router()`:

```python
# ✅ Correct
router = APIRouter(prefix="/items", tags=["items"])
app.include_router(router)

# ❌ DO NOT DO THIS
router = APIRouter()
app.include_router(router, prefix="/items", tags=["items"])
```

Apply shared dependencies at router level:

```python
router = APIRouter(
    prefix="/items",
    dependencies=[Depends(verify_token)],
)
```

## 6. One HTTP Operation Per Function

```python
# ✅ Correct
@app.get("/items/")
async def list_items(): ...

@app.post("/items/")
async def create_item(item: Item): ...

# ❌ DO NOT DO THIS
@app.api_route("/items/", methods=["GET", "POST"])
async def handle_items(request: Request):
    if request.method == "GET": ...
```

## 7. Abstract Base Classes (ABC)

Every service and repository MUST inherit from an ABC:

```python
from abc import ABC, abstractmethod

class IBacklinkRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: str) -> Backlink | None:
        ...

class BacklinkRepository(IBacklinkRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, id: str) -> Backlink | None:
        result = await self._session.execute(
            select(Backlink).where(Backlink.id == id)
        )
        return result.scalar_one_or_none()
```

## 8. Dependency Injection

See [references/dependencies.md](references/dependencies.md) for:
- `yield` with `scope` patterns
- Why to avoid class dependencies
- Router-level dependency application

## 9. Pydantic Validation for 3rd Party Data

NEVER pass raw dicts from external APIs:

```python
class DataForSEOKeyword(BaseModel):
    keyword: str
    search_volume: int = Field(alias="search_volume", default=0)
    cpc: float = Field(default=0.0, ge=0.0)

    @field_validator("cpc", mode="before")
    @classmethod
    def ensure_positive(cls, v):
        return max(0.0, float(v or 0))
```

**DO NOT** use `RootModel` — use `Annotated` with validation:

```python
# ✅ Correct
@app.post("/items/")
async def create_items(items: Annotated[list[int], Field(min_length=1), Body()]):
    return items

# ❌ DO NOT DO THIS
class ItemList(RootModel[list[int]]): ...
```

## 10. Exception Handling

Services raise domain exceptions, NOT `HTTPException`:

```python
class NotFoundException(AppException):
    def __init__(self, resource: str, id: str):
        super().__init__(f"{resource} '{id}' not found", "NOT_FOUND")

class ExternalServiceError(AppException):
    def __init__(self, service: str, message: str, original: Exception | None = None):
        self.service = service
        self.original = original
        super().__init__(f"[{service}] {message}", "EXTERNAL_ERROR")
```

## 11. Streaming

See [references/streaming.md](references/streaming.md) for:
- JSON Lines streaming
- Server-Sent Events (`EventSourceResponse`, `ServerSentEvent`)
- Byte streaming (`StreamingResponse`)

## 12. reStructuredText Docstrings

```python
async def smart_attach(self, backlink_id: str, request: SmartAttachRequest) -> SmartAttachResponse:
    """Select accounts and create queued attachments.

    :param backlink_id: target backlink UUID
    :param request: selection parameters
    :returns: response with created attachments
    :raises NotFoundException: if backlink not found
    """
```

**Anti-patterns:**
- ❌ `"""Create a new backlink"""` (duplicates function name)
- ❌ Google-style (`Args:`, `Returns:`)
- ✅ Concise reST (`:param:`, `:returns:`, `:raises:`)

## 13. Tooling

See [references/tooling.md](references/tooling.md) for:
- **uv** — package management (prefer over pip)
- **Ruff** — linting and formatting
- **ty** — type checking
- **HTTPX** — HTTP client (prefer over Requests)
- **Asyncer** — async/sync mixing
- **SQLModel** — SQL databases (prefer over raw SQLAlchemy)
- **fastapi CLI** — `fastapi dev`, `fastapi run`

## 14. File Organization

```
app/
├── interfaces/          # ABC interfaces
├── models/              # SQLAlchemy/SQLModel entities
├── schemas/             # Pydantic request/response
│   └── external/        # 3rd party response models
├── repositories/        # Data access
├── services/            # Business logic
├── integrations/        # 3rd party adapters
├── transports/api/v1/   # Route handlers (thin)
├── dependencies/        # FastAPI DI providers
├── exceptions/          # Domain exceptions
├── prompts/             # LLM templates (if applicable)
└── cores/               # Config, database, logger
```

## 15. Code Quality Checklist

- [ ] `Annotated` style for all params/deps
- [ ] Return types declared on all endpoints
- [ ] `async def` only when awaiting
- [ ] Router prefix/tags on router, not include_router
- [ ] One HTTP operation per function
- [ ] Services/repos inherit from ABC
- [ ] Route handlers thin (< 10 lines)
- [ ] 3rd party responses validated via Pydantic
- [ ] Domain exceptions (not HTTPException in services)
- [ ] reST docstrings (`:param:`, `:returns:`, `:raises:`)
- [ ] Files under 200 lines
