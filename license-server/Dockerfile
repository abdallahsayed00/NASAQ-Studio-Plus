FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js nasaq-payments.js create-admin.js ./
COPY migrations ./migrations
COPY public ./public
EXPOSE 8787
CMD ["node","server.js"]
