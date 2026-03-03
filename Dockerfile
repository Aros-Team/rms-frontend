# Frontend RMS - Angular 20
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 4200
CMD ["npm", "run", "start"]
