FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /var/log/nginx && \
    touch /var/log/nginx/access.log /var/log/nginx/error.log /var/log/nginx/blocked.log

