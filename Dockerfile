FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start"]
