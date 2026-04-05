from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.customer import Customer, Contact
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerOut, ContactCreate, ContactUpdate, ContactOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
async def list_customers(
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Customer).options(selectinload(Customer.contacts)).order_by(Customer.name)
    if q:
        stmt = stmt.where(or_(Customer.name.ilike(f"%{q}%"), Customer.email.ilike(f"%{q}%")))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(payload: CustomerCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    await db.commit()
    stmt = select(Customer).options(selectinload(Customer.contacts)).where(Customer.id == customer.id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(Customer).options(selectinload(Customer.contacts)).where(Customer.id == customer_id)
    result = await db.execute(stmt)
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(customer_id: int, payload: CustomerUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(Customer).options(selectinload(Customer.contacts)).where(Customer.id == customer_id)
    result = await db.execute(stmt)
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(customer, field, val)
    await db.commit()
    await db.refresh(customer)
    result2 = await db.execute(select(Customer).options(selectinload(Customer.contacts)).where(Customer.id == customer_id))
    return result2.scalar_one()


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.is_active = False
    await db.commit()


# --- Contacts ---

@router.post("/{customer_id}/contacts", response_model=ContactOut, status_code=201)
async def add_contact(customer_id: int, payload: ContactCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Customer not found")
    contact = Contact(customer_id=customer_id, **payload.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.put("/{customer_id}/contacts/{contact_id}", response_model=ContactOut)
async def update_contact(customer_id: int, contact_id: int, payload: ContactUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Contact).where(Contact.id == contact_id, Contact.customer_id == customer_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(contact, field, val)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{customer_id}/contacts/{contact_id}", status_code=204)
async def delete_contact(customer_id: int, contact_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Contact).where(Contact.id == contact_id, Contact.customer_id == customer_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()
