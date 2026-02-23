FROM node:22-slim

WORKDIR /app

# Install build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files and install
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --production

# Copy source
WORKDIR /app
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create data directory
RUN mkdir -p /app/backend/data /app/backend/uploads

# Initialize database
WORKDIR /app/backend
RUN node db/init.js

EXPOSE 3000

CMD ["node", "server.js"]
