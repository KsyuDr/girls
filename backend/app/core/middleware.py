"""ASGI-middleware: предел размера тела запроса и заголовки безопасности."""

from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import PayloadTooLargeError

TOO_LARGE = "Запрос слишком большой: фото — до 5 МБ каждое, не больше 4 на метку"


class BodySizeLimitMiddleware:
    """Отклоняет тело больше max_bytes: сразу по Content-Length, а без него — по мере чтения.

    Starlette сам общий размер multipart не ограничивает. Тот же предел стоит задать и на прокси.
    """

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        length = dict(scope["headers"]).get(b"content-length", b"")
        if length.isdigit() and int(length) > self.max_bytes:
            await JSONResponse({"detail": TOO_LARGE}, status_code=413)(scope, receive, send)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    # FastAPI пробрасывает HTTPException из чтения тела как есть → 413
                    raise PayloadTooLargeError(TOO_LARGE)
            return message

        await self.app(scope, limited_receive, send)


class SecurityHeadersMiddleware:
    """nosniff: браузер не станет исполнять файл как HTML/JS вопреки Content-Type."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.setdefault("X-Content-Type-Options", "nosniff")
            await send(message)

        await self.app(scope, receive, send_with_headers)
