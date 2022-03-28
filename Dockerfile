# build env
FROM node:16.14.0 as build
# set working directory
WORKDIR /app
# install app dependencies
COPY package.json ./
RUN yarn install --frozen-lockfile --ignore-optional
# add app
COPY . ./

#SET API URL
ARG REACT_APP_MAINNET_BEACON_API
ARG REACT_APP_PRATER_BEACON_API
ARG REACT_APP_KILN_BEACON_API
ARG REACT_APP_KILN_EXECUTION_API

ENV REACT_APP_MAINNET_BEACON_API=$REACT_APP_MAINNET_BEACON_API
ENV REACT_APP_PRATER_BEACON_API=$REACT_APP_PRATER_BEACON_API
ENV REACT_APP_KILN_BEACON_API=$REACT_APP_KILN_BEACON_API
ENV REACT_APP_KILN_EXECUTION_API=$REACT_APP_KILN_EXECUTION_API
# build app    
RUN yarn build

# production env
FROM nginx:stable-alpine
#copy build artifacts from build stage
COPY --from=build /app/build /usr/share/nginx/html
#expose nginx on port 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]