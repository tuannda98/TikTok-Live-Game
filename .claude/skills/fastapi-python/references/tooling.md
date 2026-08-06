# Tooling & Libraries

## Package Management — uv

Prefer uv over pip:

```bash
uv add fastapi
uv add --dev pytest
uv sync
```

## Linting & Formatting — Ruff

```bash
uv add --dev ruff
ruff check .
ruff format .
```

Enable FastAPI rules in `pyproject.toml`:

```toml
[tool.ruff.lint]
select = ["E", "F", "I", "FAST"]
```

## Type Checking — ty

```bash
uv add --dev ty
ty check
```

## HTTP Client — HTTPX

Prefer HTTPX over Requests (async support):

```bash
uv add httpx
```

```python
import httpx

# Async usage
async with httpx.AsyncClient() as client:
    response = await client.get("https://api.example.com")

# Sync usage
response = httpx.get("https://api.example.com")
```

## Async/Sync Mixing — Asyncer

```bash
uv add asyncer
```

```python
from asyncer import asyncify, syncify

# Blocking → async
result = await asyncify(blocking_func)(arg)

# Async → sync
result = syncify(async_func)(arg)
```

## SQL Database — SQLModel

Prefer SQLModel over raw SQLAlchemy (Pydantic integration):

```bash
uv add sqlmodel
```

```python
from sqlmodel import Field, SQLModel

class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    secret_name: str
    age: int | None = None
```

## FastAPI CLI

Development server:

```bash
fastapi dev
```

Production server:

```bash
fastapi run
```

Set entrypoint in `pyproject.toml`:

```toml
[tool.fastapi]
entrypoint = "my_app.main:app"
```
