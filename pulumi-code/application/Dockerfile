FROM --platform=linux/amd64 node:18-alpine

WORKDIR /usr/app
ENV API_GATEWAY_URL=''

COPY . .
RUN yarn && yarn add typescript tsc ts-node && yarn build

EXPOSE 80
CMD ["node", "dist/app.js"]