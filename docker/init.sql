-- Script de inicialização do banco de desenvolvimento
-- Executado automaticamente pelo Docker na primeira inicialização

-- Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Habilitar extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
