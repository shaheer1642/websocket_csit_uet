FROM node:18

COPY . /

RUN git clone https://github.com/shaheer1642/website_csit_uet.git /front_end

WORKDIR /front_end

RUN npm install

RUN npm run build

WORKDIR /

RUN npm install

# RUN sleep 3

CMD sleep 3 && npm run deploy