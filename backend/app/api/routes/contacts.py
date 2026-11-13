from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, Id
from app.db.session import SessionDep
from app.schemas.contact import ContactCreateIn, ContactOut, ContactUpdateIn
from app.services import contacts as contacts_service

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactOut], summary="Мои экстренные контакты")
async def list_contacts(user: CurrentUser, session: SessionDep) -> list[ContactOut]:
    contacts = await contacts_service.list_contacts(session, user.id)
    return [ContactOut.model_validate(c) for c in contacts]


@router.post(
    "",
    response_model=ContactOut,
    status_code=status.HTTP_201_CREATED,
    summary="Добавить контакт (не больше 5)",
)
async def create_contact(
    data: ContactCreateIn, user: CurrentUser, session: SessionDep
) -> ContactOut:
    contact = await contacts_service.create_contact(session, user, data)
    return ContactOut.model_validate(contact)


@router.patch(
    "/{contact_id}",
    response_model=ContactOut,
    summary="Изменить контакт, в том числе флаг «получает SOS»",
)
async def update_contact(
    contact_id: Id, data: ContactUpdateIn, user: CurrentUser, session: SessionDep
) -> ContactOut:
    contact = await contacts_service.update_contact(session, user, contact_id, data)
    return ContactOut.model_validate(contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Удалить контакт")
async def delete_contact(contact_id: Id, user: CurrentUser, session: SessionDep) -> Response:
    await contacts_service.delete_contact(session, user, contact_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
