import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  pessoas,
  registrosConsentimento,
  textosConsentimento,
  tiposConsentimento,
} from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";
import { esperarErroPg } from "../apoio/erros-pg";

const MENSAGEM = /não pode ser alterado nem apagado/;

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

async function criarPessoa() {
  const [pessoa] = await banco.db
    .insert(pessoas)
    .values({ nome: "Pessoa de teste" })
    .returning();
  return pessoa;
}

async function criarTipo() {
  const [tipo] = await banco.db
    .insert(tiposConsentimento)
    .values({ chave: `tipo_${randomUUID()}`, nome: "Tipo de teste" })
    .returning();
  return tipo;
}

async function criarTexto(tipoId: string, versao = 1) {
  const [texto] = await banco.db
    .insert(textosConsentimento)
    .values({
      tipoId,
      versao,
      texto: "Texto de teste",
      vigenteDesde: new Date(),
    })
    .returning();
  return texto;
}

async function criarRegistro() {
  const tipo = await criarTipo();
  const texto = await criarTexto(tipo.id);
  const pessoa = await criarPessoa();
  const [registro] = await banco.db
    .insert(registrosConsentimento)
    .values({
      tipoId: tipo.id,
      textoId: texto.id,
      titularId: pessoa.id,
      concedenteId: pessoa.id,
      acao: "aceite",
      canal: "plataforma",
      origem: "pagina_preferencias",
    })
    .returning();
  return { tipo, texto, pessoa, registro };
}

it("traz os seis tipos iniciais", async () => {
  const linhas = await banco.db
    .select({ chave: tiposConsentimento.chave })
    .from(tiposConsentimento);
  // Ignora os tipos criados por outros testes deste arquivo.
  const chaves = linhas
    .map((l) => l.chave)
    .filter((c) => !c.startsWith("tipo_"));
  expect(chaves.sort()).toEqual(
    [
      "lista_quem_vai",
      "politica_privacidade",
      "termos_uso",
      "uso_imagem",
      "whatsapp_novidades",
      "whatsapp_servico",
    ].sort(),
  );
});

it("marca como obrigatórios só termos de uso e política de privacidade", async () => {
  const linhas = await banco.db
    .select()
    .from(tiposConsentimento)
    .where(eq(tiposConsentimento.obrigatorio, true));
  expect(linhas.map((l) => l.chave).sort()).toEqual([
    "politica_privacidade",
    "termos_uso",
  ]);
});

it("aceita inserir um registro", async () => {
  const { registro } = await criarRegistro();
  expect(registro.id).toBeDefined();
  expect(registro.criadoEm).toBeInstanceOf(Date);
});

it("bloqueia UPDATE em registros_consentimento", async () => {
  const { registro } = await criarRegistro();
  await expect(
    banco.sql(
      `update registros_consentimento set acao = 'cancelamento' where id = '${registro.id}'`,
    ),
  ).rejects.toThrow(MENSAGEM);
});

it("bloqueia DELETE em registros_consentimento", async () => {
  const { registro } = await criarRegistro();
  await expect(
    banco.sql(
      `delete from registros_consentimento where id = '${registro.id}'`,
    ),
  ).rejects.toThrow(MENSAGEM);
});

it("bloqueia TRUNCATE em registros_consentimento", async () => {
  await criarRegistro();
  await expect(banco.sql("truncate registros_consentimento")).rejects.toThrow(
    MENSAGEM,
  );
});

it("bloqueia UPDATE e DELETE em textos_consentimento", async () => {
  const tipo = await criarTipo();
  const texto = await criarTexto(tipo.id);
  await expect(
    banco.sql(
      `update textos_consentimento set texto = 'outro' where id = '${texto.id}'`,
    ),
  ).rejects.toThrow(MENSAGEM);
  await expect(
    banco.sql(`delete from textos_consentimento where id = '${texto.id}'`),
  ).rejects.toThrow(MENSAGEM);
});

it("impede remover pessoa que tem registro de consentimento", async () => {
  const { pessoa } = await criarRegistro();
  await esperarErroPg(
    banco.db.delete(pessoas).where(eq(pessoas.id, pessoa.id)),
    "23503",
  );
});

it("recusa versão de texto repetida para o mesmo tipo", async () => {
  const tipo = await criarTipo();
  await criarTexto(tipo.id, 1);
  await esperarErroPg(criarTexto(tipo.id, 1), "23505");
});

it("recusa registro cujo texto pertence a outro tipo", async () => {
  const tipoA = await criarTipo();
  const tipoB = await criarTipo();
  const textoDeB = await criarTexto(tipoB.id);
  const pessoa = await criarPessoa();
  await esperarErroPg(
    banco.db.insert(registrosConsentimento).values({
      tipoId: tipoA.id,
      textoId: textoDeB.id,
      titularId: pessoa.id,
      concedenteId: pessoa.id,
      acao: "aceite",
      canal: "plataforma",
      origem: "pagina_preferencias",
    }),
    "23503",
  );
});

it("bloqueia TRUNCATE ... CASCADE vindo de pessoas e de tipos_consentimento", async () => {
  await criarRegistro();
  await expect(banco.sql("truncate pessoas cascade")).rejects.toThrow(MENSAGEM);
  await expect(
    banco.sql("truncate tipos_consentimento cascade"),
  ).rejects.toThrow(MENSAGEM);
});

it("impede remover o concedente (responsável) que tem registro", async () => {
  const tipo = await criarTipo();
  const texto = await criarTexto(tipo.id);
  const aluno = await criarPessoa();
  const responsavel = await criarPessoa();
  await banco.db.insert(registrosConsentimento).values({
    tipoId: tipo.id,
    textoId: texto.id,
    titularId: aluno.id,
    concedenteId: responsavel.id,
    acao: "aceite",
    canal: "whatsapp",
    contato: "+5511999999999",
    origem: "mensagem_whatsapp",
  });
  await esperarErroPg(
    banco.db.delete(pessoas).where(eq(pessoas.id, responsavel.id)),
    "23503",
  );
});

it("não deixa trocar a chave de um tipo, mas permite editar o nome", async () => {
  const tipo = await criarTipo();
  await expect(
    banco.sql(
      `update tipos_consentimento set chave = 'outra_${randomUUID()}' where id = '${tipo.id}'`,
    ),
  ).rejects.toThrow(/chave do tipo de consentimento não pode ser alterada/);
  await banco.db
    .update(tiposConsentimento)
    .set({ nome: "Novo nome" })
    .where(eq(tiposConsentimento.id, tipo.id));
  const [lido] = await banco.db
    .select()
    .from(tiposConsentimento)
    .where(eq(tiposConsentimento.id, tipo.id));
  expect(lido.nome).toBe("Novo nome");
  expect(lido.chave).toBe(tipo.chave);
});
