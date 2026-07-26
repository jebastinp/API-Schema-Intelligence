from pydantic import BaseModel, EmailStr


class CurrentUser(BaseModel):
    supabase_user_id: str
    email: EmailStr
    full_name: str | None = None
