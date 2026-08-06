# Streaming Patterns

## JSON Lines

Declare return type, use `yield`:

```python
from collections.abc import AsyncIterable

@app.get("/items/stream")
async def stream_items() -> AsyncIterable[Item]:
    for item in items:
        yield item
```

## Server-Sent Events (SSE)

Use `EventSourceResponse` with `yield`:

```python
from collections.abc import AsyncIterable
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    price: float

@app.get("/items/stream", response_class=EventSourceResponse)
async def stream_items() -> AsyncIterable[Item]:
    yield Item(name="Plumbus", price=32.99)
    yield Item(name="Portal Gun", price=999.99)
```

For full SSE control (`event`, `id`, `retry`):

```python
@app.get("/events", response_class=EventSourceResponse)
async def stream_events() -> AsyncIterable[ServerSentEvent]:
    yield ServerSentEvent(data={"status": "started"}, event="status", id="1")
    yield ServerSentEvent(data={"progress": 50}, event="progress", id="2")
```

Use `raw_data` for pre-formatted strings (no JSON encoding):

```python
yield ServerSentEvent(raw_data="plain text line", event="log")
```

## Byte Streaming

Use `StreamingResponse` subclass with `yield`:

```python
from fastapi.responses import StreamingResponse

class PNGStreamingResponse(StreamingResponse):
    media_type = "image/png"

@app.get("/image", response_class=PNGStreamingResponse)
def stream_image():
    with open("image.png", "rb") as f:
        yield from f
```

**DO NOT** return `StreamingResponse` directly:

```python
# ❌ DO NOT DO THIS
@app.get("/")
async def main():
    return StreamingResponse(read_image())
```
