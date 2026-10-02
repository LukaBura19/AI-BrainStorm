"""Pomoćna polja za multipart POST /public/bookings u testovima."""


def booking_multipart_data(
    *,
    subject_id,
    teacher_id,
    start_time: str,
    duration: int,
    client_full_name: str,
    client_email: str,
    client_category: str,
    client_note: str | None = None,
    delivery_mode: str = "in_person",
    session_type: str = "individual",
) -> dict:
    d = {
        "subject_id": str(subject_id),
        "teacher_id": str(teacher_id),
        "start_time": start_time,
        "duration": str(duration),
        "client_full_name": client_full_name,
        "client_email": client_email,
        "client_category": client_category,
        "delivery_mode": delivery_mode,
        "session_type": session_type,
    }
    if client_note is not None:
        d["client_note"] = client_note
    return d
