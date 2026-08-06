# Async vs Sync Rules

## When to Use `async def`

Use `async def` ONLY when:
- All code inside uses `await` (async I/O)
- Calling async libraries (httpx, asyncpg, aiofiles)

```python
@app.get("/async-items/")
async def read_async_items():
    data = await some_async_library.fetch_items()  # ✅ awaited
    return data
```

## When to Use `def` (Default)

Use regular `def` when:
- Calling blocking/sync code
- In doubt — default to `def`

```python
@app.get("/items/")
def read_items():
    data = some_blocking_library.fetch_items()  # sync call
    return data
```

FastAPI runs `def` functions in a threadpool — they don't block the event loop.

## CRITICAL: Never Block Inside `async def`

```python
# ❌ PERFORMANCE DISASTER — blocks event loop
@app.get("/bad/")
async def bad_endpoint():
    data = requests.get("https://api.example.com")  # BLOCKING in async!
    return data.json()
```

## Mixing Async and Sync — Use Asyncer

When you must run blocking code inside async (or vice versa):

```bash
uv add asyncer
```

```python
from asyncer import asyncify, syncify

# Run blocking code inside async
@app.get("/items/")
async def read_items():
    result = await asyncify(blocking_function)(name="World")
    return {"message": result}

# Run async code inside sync
@app.get("/sync-items/")
def read_sync_items():
    result = syncify(async_function)(name="World")
    return {"message": result}
```

Prefer Asyncer over AnyIO or asyncio directly.
