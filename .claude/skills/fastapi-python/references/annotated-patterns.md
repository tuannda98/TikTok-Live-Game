# Annotated Patterns

Always use `Annotated` style for parameter and dependency declarations.

## Parameter Declarations

```python
from typing import Annotated
from fastapi import Path, Query, Header

@app.get("/items/{item_id}")
async def read_item(
    item_id: Annotated[int, Path(ge=1, description="The item ID")],
    q: Annotated[str | None, Query(max_length=50)] = None,
    x_token: Annotated[str | None, Header()] = None,
):
    return {"item_id": item_id}
```

**DO NOT** use default assignment style:

```python
# ❌ DO NOT DO THIS
@app.get("/items/{item_id}")
async def read_item(
    item_id: int = Path(ge=1),
    q: str | None = Query(default=None, max_length=50),
):
    ...
```

## Dependency Type Aliases

Create reusable type aliases for dependencies:

```python
from typing import Annotated
from fastapi import Depends

def get_current_user() -> User:
    ...

def get_db_session() -> AsyncSession:
    ...

# Type aliases — reusable across routes
CurrentUserDep = Annotated[User, Depends(get_current_user)]
DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]

@app.get("/items/")
async def list_items(
    user: CurrentUserDep,
    db: DbSessionDep,
):
    ...
```

## No Ellipsis for Required Parameters

Do not use `...` as default for required params:

```python
# ✅ Correct — no ellipsis needed
class Item(BaseModel):
    name: str
    price: float = Field(gt=0)

@app.post("/items/")
async def create_item(
    item: Item,
    project_id: Annotated[int, Query()],
):
    ...
```

```python
# ❌ DO NOT DO THIS
class Item(BaseModel):
    name: str = ...
    price: float = Field(..., gt=0)

@app.post("/items/")
async def create_item(
    item: Item,
    project_id: Annotated[int, Query(...)],
):
    ...
```
