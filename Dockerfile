FROM node:18

RUN git clone https://github.com/shaheer1642/website_csit_uet.git /front_end

WORKDIR /front_end

RUN echo "GENERATE_SOURCEMAP=false" >> .env
RUN echo "REACT_APP_SOCKET_URL=https://csituet.up.railway.app/" >> .env
RUN echo "REACT_APP_ENV=production" >> .env

RUN npm install

RUN npm run build

WORKDIR /