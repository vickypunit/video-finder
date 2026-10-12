FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production PORT=4000 DB_PATH=/data/app.db
VOLUME /data
EXPOSE 4000
CMD ["node", "src/server.js"]
