FROM node:16.0.0
# set working directory
WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# install app dependencies
COPY package.json ./

RUN rm -rf node_modules && yarn install  --verbose --frozen-lockfile

# add app
COPY . ./


# start app
CMD ["yarn", "start"]