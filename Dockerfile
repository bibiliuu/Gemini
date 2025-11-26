# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies (root + server)
RUN npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Build Frontend
RUN npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy built assets and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./

# Install ONLY production dependencies for server
WORKDIR /app/server
RUN npm install --production

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "index.js"]
