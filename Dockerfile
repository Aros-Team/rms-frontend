# Frontend RMS - Angular 21
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4200
CMD ["/usr/local/bin/docker-entrypoint.sh"]
