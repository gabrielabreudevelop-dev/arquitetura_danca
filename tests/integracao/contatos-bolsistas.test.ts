import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { contatos, pessoas, situacoesBolsista } from "@/servidor/banco/esquema";
import { salvarMensagem } from "@/servidor/configuracoes/mensagens-prontas";
import {
  marcarResultado,
  prepararContato,
  registrarContato,
} from "@/servidor/contatos/contatos";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarBolsista,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;
let outra: Awaited<ReturnType<typeof criarAdministracao>>;

const HOJE = "2026-11-26"; // quinta
const SEMENTE =
  "Oi, Bruno! Sentimos sua falta nas aulas de terças e quintas. Tudo bem por aí?";
const RECENTE =
  "Outra pessoa da equipe já chamou este contato hoje. Confira antes de chamar de novo.";
const INATIVO = "Este bolsista está inativo. Reative antes.";

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
  outra = await criarAdministracao(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

function ok<T>(r: { ok: true; valor: T } | { ok: false; erros: unknown }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.valor;
}
function erros<T>(
  r: { ok: true; valor: T } | { ok: false; erros: Record<string, string> },
): Record<string, string> {
  if (r.ok) throw new Error("era para dar erro");
  return r.erros;
}
const digitos = (n: string | null) => (n ?? "").replace(/\D/g, "");
const textoDoLink = (url: string) => new URL(url).searchParams.get("text");

async function bolsista(
  nome: string,
  dias = [2, 4],
  extra: { nascimento?: string; responsavelId?: string } = {},
) {
  const b = await criarBolsista(banco.db, {
    criadoPor: adm.id,
    dias,
    nascimento: extra.nascimento,
  });
  await banco.db.update(pessoas).set({ nome }).where(eq(pessoas.id, b.id));
  if (extra.responsavelId) {
    await banco.sql(
      `insert into responsabilidades (responsavel_id, aluno_id) values ('${extra.responsavelId}', '${b.id}')`,
    );
  }
  return b;
}

const preparar = (
  ids: string[],
  lista: "bolsista_ausente" | "ficha_bolsista",
) => prepararContato(banco.db, { alunoIds: ids, lista }, HOJE);

describe("prepararContato de bolsista", () => {
  it("monta o wa.me com a semente preenchida", async () => {
    const b = await bolsista("Bruno Lima");
    const p = ok(await preparar([b.id], "bolsista_ausente"));
    expect(p.texto).toBe(SEMENTE);
    expect(p.pessoa.pessoaId).toBe(b.id);
    expect(textoDoLink(p.url)).toBe(SEMENTE);
    expect(p.url.startsWith(`https://wa.me/${digitos(b.whatsapp)}`)).toBe(true);
  });

  it("a ficha usa a mesma finalidade", async () => {
    const b = await bolsista("Bruno Ficha");
    const p = ok(await preparar([b.id], "ficha_bolsista"));
    expect(p.texto).toBe(SEMENTE);
  });

  it("menor: contata o responsável, com o nome dele", async () => {
    const resp = await criarAluno(banco.db, { nome: "Carla Souza" });
    const b = await bolsista("Bruno Menor", [1], {
      nascimento: "2014-03-10",
      responsavelId: resp.id,
    });
    const p = ok(await preparar([b.id], "bolsista_ausente"));
    expect(p.pessoa.pessoaId).toBe(resp.id);
    expect(p.pessoa.ehResponsavel).toBe(true);
    expect(textoDoLink(p.url)).toBe(
      "Oi, Carla! Sentimos sua falta nas aulas de segundas. Tudo bem por aí?",
    );
    expect(p.url.startsWith(`https://wa.me/${digitos(resp.whatsapp)}`)).toBe(
      true,
    );
  });

  it("irmãos bolsistas: {dias} é a união dos dias dos acordos vigentes", async () => {
    const resp = await criarAluno(banco.db, { nome: "Marta Dias" });
    const a = await bolsista("Ana Dias", [2], {
      nascimento: "2014-03-10",
      responsavelId: resp.id,
    });
    const c = await bolsista("Caio Dias", [4, 2], {
      nascimento: "2015-03-10",
      responsavelId: resp.id,
    });
    const d = await bolsista("Duda Dias", [5], {
      nascimento: "2016-03-10",
      responsavelId: resp.id,
    });
    const p = ok(await preparar([a.id, c.id, d.id], "bolsista_ausente"));
    expect(textoDoLink(p.url)).toBe(
      "Oi, Marta! Sentimos sua falta nas aulas de terças, quintas e sextas. Tudo bem por aí?",
    );
  });

  it("inativo é recusado", async () => {
    const b = await bolsista("Bruno Inativo");
    await banco.db.insert(situacoesBolsista).values({
      pessoaId: b.id,
      tipo: "inativacao",
      data: "2026-11-10",
      criadoPor: adm.id,
    });
    expect(erros(await preparar([b.id], "bolsista_ausente"))).toEqual({
      _: INATIVO,
    });
  });

  it("recusa id que não é de bolsista (aluno comum) e contatos diferentes", async () => {
    const aluno = await criarAluno(banco.db);
    expect(erros(await preparar([aluno.id], "bolsista_ausente"))).toEqual({
      _: "Aluno não encontrado.",
    });
    const x = await bolsista("Xavier Um");
    const y = await bolsista("Yuri Dois");
    expect(erros(await preparar([x.id, y.id], "bolsista_ausente"))).toEqual({
      _: "Esses alunos não têm o mesmo contato.",
    });
  });

  it("bloqueio e sem WhatsApp valem como no M2", async () => {
    const semZap = await bolsista("Sem Zap");
    await banco.db
      .update(pessoas)
      .set({ whatsapp: null })
      .where(eq(pessoas.id, semZap.id));
    expect(erros(await preparar([semZap.id], "bolsista_ausente"))).toEqual({
      _: "Cadastre um WhatsApp antes de chamar.",
    });
    const bloq = await bolsista("Bloqueado");
    await banco.sql(
      `insert into bloqueios_contato (pessoa_id, marcado_por) values ('${bloq.id}', '${adm.id}')`,
    );
    expect(erros(await preparar([bloq.id], "bolsista_ausente"))).toEqual({
      _: "Esta pessoa pediu para não ser contatada.",
    });
  });
});

describe("registrarContato de bolsista", () => {
  const chamar = (
    ids: string[],
    feitoPor: string,
    lista: "bolsista_ausente" | "ficha_bolsista" = "bolsista_ausente",
  ) =>
    registrarContato(
      banco.db,
      { alunoIds: ids, lista, feitoPor, visto: null, confirmar: false },
      hojeEmSaoPaulo(),
    );

  it("grava uma linha por bolsista, com a lista e a mensagem da semente", async () => {
    const resp = await criarAluno(banco.db, { nome: "Rita Grava" });
    const a = await bolsista("Ana Grava", [2], {
      nascimento: "2014-03-10",
      responsavelId: resp.id,
    });
    const c = await bolsista("Caio Grava", [4], {
      nascimento: "2015-03-10",
      responsavelId: resp.id,
    });
    const r = ok(await chamar([a.id, c.id], adm.id));
    const linhas = await banco.db
      .select()
      .from(contatos)
      .where(eq(contatos.grupoId, r.grupoId));
    expect(linhas.map((l) => l.alunoId).sort()).toEqual([a.id, c.id].sort());
    for (const l of linhas) {
      expect(l.lista).toBe("bolsista_ausente");
      expect(l.pessoaContatoId).toBe(resp.id);
      expect(l.mensagemId).not.toBeNull();
      expect(l.texto).toBe(
        "Oi, Rita! Sentimos sua falta nas aulas de terças e quintas. Tudo bem por aí?",
      );
    }
  });

  it("inativo: recusa e não grava", async () => {
    const b = await bolsista("Inativo Grava");
    await banco.db.insert(situacoesBolsista).values({
      pessoaId: b.id,
      tipo: "inativacao",
      data: "2026-11-10",
      criadoPor: adm.id,
    });
    expect(erros(await chamar([b.id], adm.id))).toEqual({ _: INATIVO });
    expect(
      await banco.db.select().from(contatos).where(eq(contatos.alunoId, b.id)),
    ).toHaveLength(0);
  });

  it("aluno vencido chamado hoje por outra pessoa: contato como bolsista volta com MENSAGEM_RECENTE", async () => {
    const pessoa = await bolsista("Bruno Duplo");
    // A mesma pessoa de contato foi chamada hoje na lista de alunos.
    await banco.db.insert(contatos).values({
      grupoId: crypto.randomUUID(),
      alunoId: pessoa.id,
      pessoaContatoId: pessoa.id,
      whatsapp: pessoa.whatsapp ?? "",
      lista: "vencido",
      texto: "Oi",
      criadoPor: outra.id,
    });
    expect(erros(await chamar([pessoa.id], adm.id))).toEqual({
      _: RECENTE,
    });
    // Com a confirmação, passa.
    const r = await registrarContato(
      banco.db,
      {
        alunoIds: [pessoa.id],
        lista: "bolsista_ausente",
        feitoPor: adm.id,
        visto: null,
        confirmar: true,
      },
      hojeEmSaoPaulo(),
    );
    expect(r.ok).toBe(true);
  });

  it("a ficha do bolsista também avisa do contato recente", async () => {
    const b = await bolsista("Ficha Recente");
    ok(await chamar([b.id], outra.id));
    expect(erros(await chamar([b.id], adm.id, "ficha_bolsista"))).toEqual({
      _: RECENTE,
    });
  });
});

describe("marcarResultado por tipo de contato", () => {
  const MSG = "Escolha um resultado da lista.";

  async function contatoDeBolsista() {
    const b = await bolsista("Resultado Bolsista");
    const r = ok(
      await registrarContato(
        banco.db,
        {
          alunoIds: [b.id],
          lista: "bolsista_ausente",
          feitoPor: adm.id,
          visto: null,
          confirmar: true,
        },
        hojeEmSaoPaulo(),
      ),
    );
    return { b, grupoId: r.grupoId };
  }

  async function contatoDeAluno() {
    const a = await criarAluno(banco.db);
    const grupoId = crypto.randomUUID();
    await banco.db.insert(contatos).values({
      grupoId,
      alunoId: a.id,
      pessoaContatoId: a.id,
      whatsapp: a.whatsapp ?? "",
      lista: "vencido",
      texto: "Oi",
      criadoPor: adm.id,
    });
    return { a, grupoId };
  }

  it("vai_voltar vale para bolsista", async () => {
    const { b, grupoId } = await contatoDeBolsista();
    ok(
      await marcarResultado(banco.db, {
        pessoaId: b.id,
        grupoIds: [grupoId],
        resultado: "vai_voltar",
        feitoPor: adm.id,
      }),
    );
    const [linha] = await banco.db
      .select()
      .from(contatos)
      .where(eq(contatos.grupoId, grupoId));
    expect(linha.resultado).toBe("vai_voltar");
  });

  it("vai_renovar é recusado para bolsista, sem mudar nada", async () => {
    const { b, grupoId } = await contatoDeBolsista();
    expect(
      erros(
        await marcarResultado(banco.db, {
          pessoaId: b.id,
          grupoIds: [grupoId],
          resultado: "vai_renovar",
          feitoPor: adm.id,
        }),
      ),
    ).toEqual({ resultado: MSG });
    const [linha] = await banco.db
      .select()
      .from(contatos)
      .where(eq(contatos.grupoId, grupoId));
    expect(linha.resultado).toBeNull();
  });

  it("vai_voltar é recusado para aluno; vai_renovar segue valendo", async () => {
    const { a, grupoId } = await contatoDeAluno();
    expect(
      erros(
        await marcarResultado(banco.db, {
          pessoaId: a.id,
          grupoIds: [grupoId],
          resultado: "vai_voltar",
          feitoPor: adm.id,
        }),
      ),
    ).toEqual({ resultado: MSG });
    ok(
      await marcarResultado(banco.db, {
        pessoaId: a.id,
        grupoIds: [grupoId],
        resultado: "vai_renovar",
        feitoPor: adm.id,
      }),
    );
  });

  it("nao_quer_contato e vai_pensar valem para bolsista", async () => {
    const { b, grupoId } = await contatoDeBolsista();
    ok(
      await marcarResultado(banco.db, {
        pessoaId: b.id,
        grupoIds: [grupoId],
        resultado: "vai_pensar",
        feitoPor: adm.id,
      }),
    );
    ok(
      await marcarResultado(banco.db, {
        pessoaId: b.id,
        grupoIds: [grupoId],
        resultado: "nao_quer_contato",
        feitoPor: adm.id,
      }),
    );
  });
});

describe("mensagem por finalidade", () => {
  it("bolsista com {fim} é recusada; renovação com {dias} é recusada", async () => {
    expect(
      erros(
        await salvarMensagem(banco.db, {
          nome: "Bolsista com fim",
          finalidade: "bolsista",
          texto: "Oi, {nome}! Até {fim}.",
          ativa: false,
        }),
      ),
    ).toEqual({ texto: "Campo {fim} não existe. Use {nome} ou {dias}." });
    expect(
      erros(
        await salvarMensagem(banco.db, {
          nome: "Renovação com dias",
          finalidade: "renovacao",
          texto: "Oi, {nome}! Aulas de {dias}.",
          ativa: false,
        }),
      ),
    ).toEqual({
      texto: "Campo {dias} não existe. Use {nome}, {aluno}, {turma} ou {fim}.",
    });
  });

  it("mudar a finalidade de uma mensagem existente revalida o texto", async () => {
    const { id } = ok(
      await salvarMensagem(banco.db, {
        nome: "Muda finalidade",
        finalidade: "bolsista",
        texto: "Oi, {nome}! Aulas de {dias}.",
        ativa: false,
      }),
    );
    expect(
      erros(
        await salvarMensagem(banco.db, {
          id,
          nome: "Muda finalidade",
          finalidade: "retorno",
          texto: "Oi, {nome}! Aulas de {dias}.",
          ativa: false,
        }),
      ),
    ).toEqual({
      texto: "Campo {dias} não existe. Use {nome}, {aluno}, {turma} ou {fim}.",
    });
  });

  it("aceita a finalidade bolsista", async () => {
    ok(
      await salvarMensagem(banco.db, {
        nome: "Bolsista ok",
        finalidade: "bolsista",
        texto: "Oi, {nome}! Aulas de {dias}.",
        ativa: false,
      }),
    );
  });
});
