FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build
FROM build AS api
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["npm", "start"]
FROM build AS worker
ENV NODE_ENV=production
USER node
CMD ["npm", "run", "worker"]
FROM nginx:stable-alpine AS customer
COPY --from=build /app/apps/customer-web/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
FROM nginx:stable-alpine AS seller
COPY --from=build /app/apps/seller-portal/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
FROM nginx:stable-alpine AS admin
COPY --from=build /app/apps/admin-portal/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
