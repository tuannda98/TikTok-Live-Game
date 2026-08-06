# Dependency Injection Patterns

## When to Use Dependencies

Use dependencies when:
- Logic can't be declared in Pydantic validation
- Depends on external resources or could block
- Results needed by sub-dependencies
- Shared across endpoints (auth, error handling)
- Need cleanup (DB sessions, file handles) — use `yield`
- Requires request data (headers, query params)

## Dependencies with `yield` and `scope`

Default scope `"request"` — cleanup after response sent:

```python
from typing import Annotated
from fastapi import Depends

def get_db():
    db = DBSession()
    try:
        yield db
    finally:
        db.close()

DBDep = Annotated[DBSession, Depends(get_db)]

@app.get("/items/")
async def read_items(db: DBDep):
    return db.query(Item).all()
```

Scope `"function"` — cleanup before response sent:

```python
def get_username():
    try:
        yield "Rick"
    finally:
        print("Cleanup before response sent")

UserNameDep = Annotated[str, Depends(get_username, scope="function")]

@app.get("/users/me")
def get_user_me(username: UserNameDep):
    return username
```

## Avoid Class Dependencies

Prefer function that returns class instance:

```python
from dataclasses import dataclass
from typing import Annotated
from fastapi import Depends

@dataclass
class Paginator:
    offset: int = 0
    limit: int = 100
    q: str | None = None

def get_paginator(
    offset: int = 0,
    limit: int = 100,
    q: str | None = None,
) -> Paginator:
    return Paginator(offset=offset, limit=limit, q=q)

PaginatorDep = Annotated[Paginator, Depends(get_paginator)]

@app.get("/items/")
async def read_items(paginator: PaginatorDep):
    return paginator.get_page()
```

**DO NOT** use class directly in `Depends()`:

```python
# ❌ DO NOT DO THIS
@app.get("/items/")
async def read_items(paginator: Annotated[Paginator, Depends()]):
    ...
```

## Router-Level Dependencies

Apply shared dependencies at router level:

```python
router = APIRouter(
    prefix="/items",
    tags=["items"],
    dependencies=[Depends(verify_token), Depends(verify_key)],
)
```
