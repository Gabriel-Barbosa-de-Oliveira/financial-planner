FROM postgres:16-alpine

ENV POSTGRES_USER=financial_user
ENV POSTGRES_PASSWORD=secure_password_123
ENV POSTGRES_DB=financial_control_db
ENV TZ=America/Sao_Paulo

COPY ./database/schema.sql /docker-entrypoint-initdb.d/01-schema.sql

EXPOSE 5432

VOLUME ["/var/lib/postgresql/data"]