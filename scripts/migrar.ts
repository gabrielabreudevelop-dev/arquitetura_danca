import { migrar } from "../src/servidor/banco/migrar";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Variável de ambiente DATABASE_URL não definida.");
  process.exit(1);
}

try {
  await migrar(url);
  console.log("Migrações aplicadas.");
} catch (erro) {
  console.error("Falha ao aplicar as migrações:", erro);
  process.exit(1);
}
