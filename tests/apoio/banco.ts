import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { type Banco, criarBanco } from "@/servidor/banco/cliente";
import { migrar } from "@/servidor/banco/migrar";

function urlAdmin(): string {
  const url = process.env.DATABASE_URL_TESTE_ADMIN;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TESTE_ADMIN não definida. Defina em .env.local (veja .env.example).",
    );
  }
  return url;
}

/**
 * Cria um banco `teste_<aleatório>` a partir de DATABASE_URL_TESTE_ADMIN,
 * aplica as migrações e o remove em `encerrar()`.
 */
export async function criarBancoDeTeste(): Promise<{
  db: Banco;
  url: string;
  sql(texto: string): Promise<unknown[]>;
  encerrar(): Promise<void>;
}> {
  const admin = urlAdmin();
  const nome = `teste_${randomBytes(8).toString("hex")}`;

  const poolAdmin = new Pool({ connectionString: admin });
  try {
    await poolAdmin.query(`create database ${nome}`);
  } finally {
    await poolAdmin.end();
  }

  const url = new URL(admin);
  url.pathname = `/${nome}`;
  const urlBanco = url.toString();

  try {
    await migrar(urlBanco);
  } catch (erro) {
    await removerBanco(admin, nome);
    throw erro;
  }

  const { db, encerrar: fecharPool } = criarBanco(urlBanco);
  const pool = new Pool({ connectionString: urlBanco });

  return {
    db,
    url: urlBanco,
    async sql(texto) {
      const resultado = await pool.query(texto);
      return resultado.rows;
    },
    async encerrar() {
      await pool.end();
      await fecharPool();
      await removerBanco(admin, nome);
    },
  };
}

async function removerBanco(admin: string, nome: string): Promise<void> {
  const pool = new Pool({ connectionString: admin });
  try {
    await pool.query(`drop database if exists ${nome} with (force)`);
  } finally {
    await pool.end();
  }
}
