"""Kompatibilni alias za staru komandu; koristi dinamički Luka test seed."""

from app.db.seed_luka_test_data import main, seed_luka_future_availability

seed_luka_april_slots = seed_luka_future_availability

if __name__ == "__main__":
    main()
