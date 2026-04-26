# Static deploy of public/findings/ via Caddy.
# Document root is set to /srv; fly.toml sets PORT to 8080.
FROM caddy:2.8-alpine

# Copy the findings page directly to the document root so "/" resolves.
COPY public/findings/ /srv/

# Caddyfile written inline — single static site, gzip + sane defaults.
RUN printf ':8080 {\n\
    root * /srv\n\
    encode zstd gzip\n\
    file_server\n\
    header {\n\
        X-Content-Type-Options nosniff\n\
        Referrer-Policy strict-origin-when-cross-origin\n\
        Cache-Control "public, max-age=300"\n\
    }\n\
}\n' > /etc/caddy/Caddyfile

EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
