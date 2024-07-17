# Stage 1: Build the Angular app
FROM node:20.11.1 AS build

WORKDIR /app

COPY . .
RUN yarn install && yarn prod-build

# Stage 2: Serve the app with Nginx
FROM nginx:1.19

# Copy built assets from Stage 1
COPY --from=build /app/dist/pan-os-upgrade /usr/share/nginx/html

# Copy Nginx configuration file
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Add HEALTHCHECK instruction
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD curl --fail http://localhost/ || exit 1

# Use environment variables directly
ENV API_URL=http://pan-os-upgrade-web-backend:8000
ENV BACKEND_PORT=8000

CMD ["nginx", "-g", "daemon off;"]
