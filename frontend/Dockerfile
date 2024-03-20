# Stage 1: Build the Angular app
FROM node:20.11.1 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:1.19

COPY --from=build /app/dist/pan-os-upgrade-web /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
