FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=${APP_VERSION}
RUN npm run build

FROM nginx:alpine AS runner

# Default backend hostname — override via BACKEND_HOST env var in k8s
ENV BACKEND_HOST=backend

COPY --from=builder /app/dist /usr/share/nginx/html
# nginx processes /etc/nginx/templates/*.template with envsubst on startup
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
