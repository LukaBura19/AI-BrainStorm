FROM node:20-alpine

WORKDIR /app

# Zavisnosti
COPY package.json package-lock.json* ./
RUN npm ci

# Kod se mountuje preko volume-a u docker-compose
COPY . .

EXPOSE 5173

# Vite dev server sa host flag-om za Docker
CMD ["npm", "run", "dev"]
