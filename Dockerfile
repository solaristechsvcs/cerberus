FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY config.js ./config.js
COPY dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
