FROM node:20-alpine AS build
WORKDIR /job_frontend
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build 

FROM nginx:alpine
COPY --from=build /job_frontend/dist /usr/share/nginx/html
EXPOSE 80