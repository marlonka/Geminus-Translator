# Build stage - compile TypeScript and build React app with Vite
FROM node:20 AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the Vite project
RUN npm run build

# Production stage - serve the built app
FROM node:20-slim

WORKDIR /app

# Copy built files from build stage
COPY --from=build /app/dist ./dist

# Install serve to run the production build
RUN npm install -g serve

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start the application
CMD ["serve", "-s", "dist", "-l", "8080"]
