"""Ошибки приложения. Это HTTPException с понятным русским текстом в поле detail."""

from fastapi import HTTPException, status


class BadRequestError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status.HTTP_400_BAD_REQUEST, detail)


class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = "Нужно войти в приложение") -> None:
        super().__init__(
            status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"}
        )


class ForbiddenError(HTTPException):
    def __init__(self, detail: str = "Недостаточно прав") -> None:
        super().__init__(status.HTTP_403_FORBIDDEN, detail)


class NotFoundError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, detail)


class ConflictError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status.HTTP_409_CONFLICT, detail)


class TooManyRequestsError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status.HTTP_429_TOO_MANY_REQUESTS, detail)


class PayloadTooLargeError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status.HTTP_413_CONTENT_TOO_LARGE, detail)
