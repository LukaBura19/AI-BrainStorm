"""
Ista osoba kao profesor i admin: prijava vraća i token za drugu ulogu (linked_tokens),
pa panel nudi prebacivanje bez nove prijave.
"""

from app.core.security import decode_access_token, hash_password
from app.models.admin import Admin
from app.models.teacher import Teacher


def _dual_role_person(db, password="tajna123"):
    teacher = Teacher(full_name="Luka Test", email="luka@test.com", password_hash=hash_password(password), is_active=True, is_approved=True)
    admin = Admin(full_name="Luka Test", email="luka@test.com", password_hash=hash_password(password), is_active=True)
    db.add_all([teacher, admin])
    db.flush()
    return teacher, admin


def test_teacher_login_links_admin_token(client, db):
    teacher, admin = _dual_role_person(db)
    resp = client.post("/auth/teacher/login", json={"email": "luka@test.com", "password": "tajna123"})
    assert resp.status_code == 200
    data = resp.json()
    assert decode_access_token(data["access_token"])["role"] == "teacher"
    linked = decode_access_token(data["linked_tokens"]["admin"])
    assert linked["role"] == "admin" and linked["sub"] == str(admin.id)
    # Vezani token zaista otvara admin rute.
    me = client.get("/admin/me", headers={"Authorization": f"Bearer {data['linked_tokens']['admin']}"})
    assert me.status_code == 200 and me.json()["email"] == "luka@test.com"


def test_admin_login_links_teacher_token(client, db):
    teacher, _ = _dual_role_person(db)
    resp = client.post("/auth/admin/login", json={"email": "luka@test.com", "password": "tajna123"})
    assert resp.status_code == 200
    linked = decode_access_token(resp.json()["linked_tokens"]["teacher"])
    assert linked["role"] == "teacher" and linked["sub"] == str(teacher.id)


def test_no_link_when_other_role_has_different_password(client, db):
    teacher = Teacher(full_name="Samo Profesor", email="dva@test.com", password_hash=hash_password("prof-lozinka"), is_active=True, is_approved=True)
    admin = Admin(full_name="Samo Admin", email="dva@test.com", password_hash=hash_password("druga-lozinka"), is_active=True)
    db.add_all([teacher, admin])
    db.flush()
    resp = client.post("/auth/teacher/login", json={"email": "dva@test.com", "password": "prof-lozinka"})
    assert resp.status_code == 200
    assert resp.json()["linked_tokens"] == {}


def test_no_link_for_unapproved_teacher(client, db):
    teacher = Teacher(full_name="Ceka", email="ceka@test.com", password_hash=hash_password("tajna123"), is_active=True, is_approved=False)
    admin = Admin(full_name="Ceka", email="ceka@test.com", password_hash=hash_password("tajna123"), is_active=True)
    db.add_all([teacher, admin])
    db.flush()
    resp = client.post("/auth/admin/login", json={"email": "ceka@test.com", "password": "tajna123"})
    assert resp.status_code == 200
    assert resp.json()["linked_tokens"] == {}


def test_student_login_has_no_linked_tokens(client, db, admin_user):
    resp = client.post("/auth/admin/login", json={"email": "admin@test.com", "password": "admin123"})
    assert resp.status_code == 200
    assert resp.json()["linked_tokens"] == {}
