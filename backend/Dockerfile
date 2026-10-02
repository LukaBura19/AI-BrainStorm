FROM python:3.12-slim

WORKDIR /app

# Sistemske zavisnosti
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python zavisnosti
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kod se mountuje preko volume-a u docker-compose
COPY . .

EXPOSE 8000

# Uvicorn sa --reload za hot reload u razvoju
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
