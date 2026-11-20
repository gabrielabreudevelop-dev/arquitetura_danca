import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
import {
  encerrarBancoCompartilhado,
  obterBanco,
} from "../src/servidor/banco/cliente";
import { criarMembroEquipe } from "../src/servidor/equipe/criar-membro";

const PAPEIS = ["administracao", "atendente"] as const;
type PapelEquipe = (typeof PAPEIS)[number];

function falhar(mensagem: string): never {
  console.error(mensagem);
  process.exit(1);
}

/** Interface única de leitura; a saída é silenciada enquanto a senha é digitada. */
let mudo = false;
const saida = new Writable({
  write(trecho, _codificacao, pronto) {
    if (!mudo) process.stdout.write(trecho);
    pronto();
  },
});
const leitor = createInterface({
  input: process.stdin,
  output: saida,
  terminal: true,
});

/** Lê uma linha do terminal sem mostrar o que é digitado. */
function perguntarSenha(pergunta: string): Promise<string> {
  return new Promise((resolver) => {
    leitor.question(pergunta, (resposta) => {
      mudo = false;
      process.stdout.write("\n");
      resolver(resposta);
    });
    mudo = true;
  });
}

// `pnpm equipe:criar -- --nome ...` pode repassar o "--" ao script.
const argumentos = process.argv
  .slice(2)
  .filter((a, i) => !(i === 0 && a === "--"));
const { values } = parseArgs({
  args: argumentos,
  options: {
    nome: { type: "string" },
    email: { type: "string" },
    papel: { type: "string" },
  },
});

const uso =
  'Uso: pnpm equipe:criar -- --nome "Ana" --email "ana@estudio.com" --papel administracao|atendente';
if (!values.nome || !values.email || !values.papel) falhar(uso);
if (!PAPEIS.includes(values.papel as PapelEquipe)) {
  falhar(`Papel inválido: "${values.papel}". Use administracao ou atendente.`);
}
if (!process.stdin.isTTY) {
  falhar("A senha é pedida no terminal; execute em um terminal interativo.");
}

const senha = await perguntarSenha("Senha (mínimo de 12 caracteres): ");
const confirmacao = await perguntarSenha("Repita a senha: ");
leitor.close();
if (senha !== confirmacao) falhar("As senhas não conferem.");

try {
  await criarMembroEquipe(obterBanco(), {
    nome: values.nome,
    email: values.email,
    senha,
    papel: values.papel as PapelEquipe,
  });
  console.log(`Membro da equipe criado: ${values.email} (${values.papel}).`);
} catch (erro) {
  falhar(erro instanceof Error ? erro.message : "Falha ao criar o membro.");
} finally {
  await encerrarBancoCompartilhado();
}
