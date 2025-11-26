FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install ONLY production dependencies for server
# We don't need root dependencies anymore since we are not building frontend
RUN cd server && npm install --production

# Copy pre-built frontend assets
COPY dist ./dist

# Copy server code
COPY server ./server

# Expose port
EXPOSE 3000

# Start command
WORKDIR /app
CMD ["node", "server/index.js"]
