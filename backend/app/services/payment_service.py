"""
Naplata karticom za pristup snimcima.

ponytail: lažni procesor sa ugrađenim test karticama. Pravi provajder (Stripe, Payten/ChipCard…)
menja samo charge(); ostatak toka (nalog, upis kupovine, email, token) ostaje isti.
"""

import secrets
from dataclasses import dataclass
from datetime import date

# Kartice koje lažni procesor prihvata. Bilo koji budući datum isteka i trocifreni CVC prolaze.
TEST_CARDS = {
    "4242424242424242": "Visa",
    "5555555555554444": "Mastercard",
}
# Kartica koja uvek vraća „odbijeno“, za probu neuspele naplate.
DECLINED_CARD = "4000000000000002"
TEST_CARD_HINT = "U test režimu prolazi samo kartica 4242 4242 4242 4242 (ili 5555 5555 5555 4444)."


class CardError(Exception):
    """Naplata nije prošla; poruka je namenjena korisniku."""


@dataclass(frozen=True)
class Charge:
    transaction_id: str
    brand: str
    last4: str


def card_digits(number: str) -> str:
    return "".join(ch for ch in number if ch.isdigit())


def luhn_ok(digits: str) -> bool:
    total = 0
    for index, ch in enumerate(reversed(digits)):
        digit = int(ch)
        if index % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0


def detect_brand(digits: str) -> str:
    if digits.startswith("4"):
        return "Visa"
    if digits[:2] in {"51", "52", "53", "54", "55"} or (digits[:4].isdigit() and 2221 <= int(digits[:4]) <= 2720):
        return "Mastercard"
    return "Kartica"


def normalize_year(year: int) -> int:
    return 2000 + year if year < 100 else year


def charge(*, number: str, exp_month: int, exp_year: int, cvc: str, holder_name: str, amount_eur: int) -> Charge:
    """Vraća Charge ako je naplata prošla, inače diže CardError sa porukom za korisnika."""
    digits = card_digits(number)
    if not 12 <= len(digits) <= 19 or not luhn_ok(digits):
        raise CardError("Broj kartice nije ispravan. Proveri cifre pa pokušaj ponovo.")
    if not holder_name.strip():
        raise CardError("Unesi ime sa kartice.")
    if not (cvc.isdigit() and 3 <= len(cvc) <= 4):
        raise CardError("CVC je trocifreni broj sa poleđine kartice.")
    year = normalize_year(exp_year)
    today = date.today()
    if not 1 <= exp_month <= 12 or (year, exp_month) < (today.year, today.month):
        raise CardError("Kartica je istekla ili datum isteka nije ispravan.")
    if amount_eur <= 0:
        raise CardError("Iznos nije ispravan.")

    if digits == DECLINED_CARD:
        raise CardError("Banka je odbila karticu. Proveri stanje ili probaj drugu karticu.")
    brand = TEST_CARDS.get(digits)
    if brand is None:
        raise CardError(f"Kartica nije prihvaćena. {TEST_CARD_HINT}")
    return Charge(transaction_id=f"test_{secrets.token_hex(10)}", brand=brand, last4=digits[-4:])
