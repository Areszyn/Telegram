FROM node:20-slim

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

ENV PORT=3003

EXPOSE 3003

CMD ["npx", "tsx", "src/index.ts"]
