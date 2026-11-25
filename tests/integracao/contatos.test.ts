import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cadastrarAluno,
  type DadosAluno,
  encerrarAluno,
} from "@/servidor/alunos/cadastro";
import { matricular } from "@/servidor/alunos/matriculas";
import { estender, registrarPeriodo } from "@/servidor/alunos/periodos";
import {
  bloqueiosContato,
  contatos,
  mensagensProntas,
} from "@/servidor/banco/esquema";
import {
  desfazerNaoQuerContato,
  marcarNaoQuerContato,
  marcarResultado,
  prepararContato,
  registrarContato,
} from "@/servidor/contatos/contatos";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarModulo,
  criarPlano,
  criarRitmo,
  criarTurma,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;
let plano: Awaited<ReturnType<typeof criarPlano>>;
let forro: Awaited<ReturnType<typeof criarTurma>>;
let samba: Awaited<ReturnType<typeof criarTurma>>;

const HOJE = "2026-11-22";

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
  plano = await criarPlano(banco.db, { nome: "Mensal" });
  forro = await criarTurma(banco.db, {
    ritmoId: (await criarRitmo(banco.db, { nome: "Forró" })).id,
    moduloId: (await criarModulo(banco.db, { nome: "Iniciante" })).id,
  });
  samba = await criarTurma(banco.db, {
    ritmoId: (await criarRitmo(banco.db, { nome: "Samba" })).id,
    moduloId: (await criarModulo(banco.db, { nome: "Intermediário" })).id,
  });
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

let sequencia = 0;
/** WhatsApp normalizado distinto a cada chamada: "5527999990001"... */
function numero(): string {
  sequencia += 1;
  return `55279${String(99990000 + sequencia)}`;
}

async function cadastrar(
  dados: Partial<DadosAluno> & { nome: string },
  hoje = HOJE,
): Promise<string> {
  const valor = ok(
    await cadastrarAluno(
      banco.db,
      { nascimento: "1990-01-01", ...dados },
      adm.id,
      hoje,
    ),
  );
  if (valor.tipo !== "criado") throw new Error(valor.tipo);
  return valor.alunoId;
}

async function periodo(alunoId: string, inicio: string, fim: string) {
  return ok(
    await registrarPeriodo(banco.db, {
      alunoId,
      planoId: plano.id,
      inicio,
      fim,
      feitoPor: adm.id,
    }),
  ).periodoId;
}

async function matricularEm(alunoId: string, turmaId: string) {
  ok(
    await matricular(banco.db, {
      alunoId,
      turmaId,
      entrada: "2026-10-01",
      feitoPor: adm.id,
    }),
  );
}

/** Texto do parâmetro `text` do link, já decodificado. */
function textoDoLink(url: string): string | null {
  return new URL(url).searchParams.get("text");
}

async function irmaos() {
  const carla = numero();
  const bruno = await cadastrar({
    nome: "Bruno Lima",
    nascimento: "2014-03-10",
    responsavel: { novo: true, nome: "Carla Lima", whatsapp: carla },
  });
  const [linhaCarla] = await banco.sql(
    `select responsavel_id from responsabilidades where aluno_id = '${bruno}'`,
  );
  const carlaId = (linhaCarla as { responsavel_id: string }).responsavel_id;
  const lia = await cadastrar({
    nome: "Lia Lima",
    nascimento: "2016-07-01",
    responsavel: { pessoaId: carlaId },
  });
  await periodo(bruno, "2026-10-01", "2026-10-31");
  await periodo(lia, "2026-10-01", "2026-11-02");
  await matricularEm(bruno, samba.id);
  await matricularEm(lia, forro.id);
  await matricularEm(lia, samba.id);
  return { bruno, lia, carla, carlaId };
}

describe("prepararContato", () => {
  it("adulto vencido: WhatsApp dele e o convite para voltar preenchido", async () => {
    const whatsapp = numero();
    const ana = await cadastrar({ nome: "Ana Souza", whatsapp });
    await periodo(ana, "2026-10-01", "2026-10-31");
    await matricularEm(ana, forro.id);

    const valor = ok(
      await prepararContato(
        banco.db,
        { alunoIds: [ana], lista: "vencido" },
        HOJE,
      ),
    );
    expect(valor.url.startsWith(`https://wa.me/${whatsapp}?text=`)).toBe(true);
    expect(textoDoLink(valor.url)).toBe(
      "Oi, Ana! Sentimos falta de Ana na pista. Que tal voltar para a turma de Forró Iniciante? Estamos te esperando.",
    );
    expect(valor.texto).toBe(textoDoLink(valor.url));
    expect(valor.mensagemId).not.toBeNull();
    expect(valor.pessoa).toMatchObject({ pessoaId: ana, nome: "Ana Souza" });
  });

  it("irmãos menores: número e saudação da mãe, alunos e turmas juntos", async () => {
    const { bruno, lia, carla } = await irmaos();
    const valor = ok(
      await prepararContato(
        banco.db,
        { alunoIds: [bruno, lia], lista: "vencido" },
        HOJE,
      ),
    );
    expect(valor.url.startsWith(`https://wa.me/${carla}?text=`)).toBe(true);
    expect(textoDoLink(valor.url)).toBe(
      "Oi, Carla! Sentimos falta de Bruno e Lia na pista. Que tal voltar para a turma de Samba Intermediário e Forró Iniciante? Estamos te esperando.",
    );
  });

  it("vence em breve usa a mensagem de renovação com os fins efetivos", async () => {
    const { bruno, lia } = await irmaos();
    await periodo(bruno, "2026-11-01", "2026-11-30");
    await periodo(lia, "2026-11-03", "2026-11-25");
    ok(
      await estender(
        banco.db,
        {
          alunoId: bruno,
          quantidade: "2",
          unidade: "dias",
          motivo: "feriado",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    );
    const valor = ok(
      await prepararContato(
        banco.db,
        { alunoIds: [bruno, lia], lista: "vence_em_breve" },
        HOJE,
      ),
    );
    expect(textoDoLink(valor.url)).toBe(
      "Oi, Carla! Tudo bem? O período de Bruno e Lia na Arquitetura da Dança vai até 02/12 e 25/11. Quer renovar para continuar dançando com a turma de Samba Intermediário e Forró Iniciante?",
    );
  });

  it("ficha: renovação se vigente, convite para voltar se vencido", async () => {
    const vigente = await cadastrar({
      nome: "Vera Vigente",
      whatsapp: numero(),
    });
    await periodo(vigente, "2026-11-01", "2026-11-30");
    const vencido = await cadastrar({
      nome: "Davi Vencido",
      whatsapp: numero(),
    });
    await periodo(vencido, "2026-10-01", "2026-10-31");

    const deVigente = ok(
      await prepararContato(
        banco.db,
        { alunoIds: [vigente], lista: "ficha" },
        HOJE,
      ),
    );
    expect(deVigente.texto).toContain("Quer renovar");
    const deVencido = ok(
      await prepararContato(
        banco.db,
        { alunoIds: [vencido], lista: "ficha" },
        HOJE,
      ),
    );
    expect(deVencido.texto).toContain("Sentimos falta de Davi");
  });

  it("adulto de 18 anos sem WhatsApp usa o número do responsável", async () => {
    const iara = numero();
    const hugo = await cadastrar(
      {
        nome: "Hugo Dezoito",
        nascimento: "2008-11-01",
        responsavel: { novo: true, nome: "Iara Pai", whatsapp: iara },
      },
      "2026-10-15",
    );
    await periodo(hugo, "2026-10-01", "2026-10-31");
    const valor = ok(
      await prepararContato(
        banco.db,
        { alunoIds: [hugo], lista: "vencido" },
        HOJE,
      ),
    );
    expect(valor.url.startsWith(`https://wa.me/${iara}?text=`)).toBe(true);
    expect(textoDoLink(valor.url)).toContain("Oi, Iara!");
    expect(textoDoLink(valor.url)).toContain("falta de Hugo");
  });

  it("alunos com contatos diferentes dão erro", async () => {
    const a = await cadastrar({ nome: "Ana Um", whatsapp: numero() });
    const b = await cadastrar({ nome: "Bia Dois", whatsapp: numero() });
    expect(
      erros(
        await prepararContato(
          banco.db,
          { alunoIds: [a, b], lista: "vencido" },
          HOJE,
        ),
      ),
    ).toEqual({ _: "Esses alunos não têm o mesmo contato." });
  });

  it("pessoa que não quer contato dá erro", async () => {
    const a = await cadastrar({ nome: "Bloqueada Silva", whatsapp: numero() });
    ok(await marcarNaoQuerContato(banco.db, { pessoaId: a, feitoPor: adm.id }));
    expect(
      erros(
        await prepararContato(
          banco.db,
          { alunoIds: [a], lista: "ficha" },
          HOJE,
        ),
      ),
    ).toEqual({ _: "Esta pessoa pediu para não ser contatada." });
  });

  it("sem WhatsApp dá erro", async () => {
    const sem = (
      await criarAluno(banco.db, { nome: "João Sem Número", whatsapp: null })
    ).id;
    expect(
      erros(
        await prepararContato(
          banco.db,
          { alunoIds: [sem], lista: "ficha" },
          HOJE,
        ),
      ),
    ).toEqual({ _: "Cadastre um WhatsApp antes de chamar." });
  });

  it("aluno inexistente, id inválido ou encerrado dão erro", async () => {
    for (const alunoIds of [
      [],
      ["não-é-uuid"],
      ["00000000-0000-4000-8000-000000000000"],
    ]) {
      expect(
        erros(
          await prepararContato(banco.db, { alunoIds, lista: "ficha" }, HOJE),
        ),
      ).toEqual({ _: "Aluno não encontrado." });
    }
    const enc = await cadastrar({
      nome: "Encerrado Silva",
      whatsapp: numero(),
    });
    ok(
      await encerrarAluno(banco.db, {
        alunoId: enc,
        data: HOJE,
        feitoPor: adm.id,
      }),
    );
    expect(
      erros(
        await prepararContato(
          banco.db,
          { alunoIds: [enc], lista: "ficha" },
          HOJE,
        ),
      ),
    ).toEqual({ _: "Este aluno está encerrado. Reabra o cadastro antes." });
  });

  it("codifica & e acentos no link", async () => {
    const ritmo = await criarRitmo(banco.db, { nome: "Xote & Baião" });
    const turma = await criarTurma(banco.db, {
      ritmoId: ritmo.id,
      moduloId: (await criarModulo(banco.db, { nome: "Avançado" })).id,
    });
    const whatsapp = numero();
    const id = await cadastrar({ nome: "Ângela Müller", whatsapp });
    await periodo(id, "2026-10-01", "2026-10-31");
    await matricularEm(id, turma.id);

    const valor = ok(
      await prepararContato(
        banco.db,
        { alunoIds: [id], lista: "vencido" },
        HOJE,
      ),
    );
    const esperado =
      "Oi, Ângela! Sentimos falta de Ângela na pista. Que tal voltar para a turma de Xote & Baião Avançado? Estamos te esperando.";
    expect(valor.url).toBe(
      `https://wa.me/${whatsapp}?text=${encodeURIComponent(esperado)}`,
    );
    expect(valor.url).toContain("%26");
    expect(valor.url).not.toMatch(/[ &]Ba/);
    expect(textoDoLink(valor.url)).toBe(esperado);
  });

  it("sem mensagem ativa: link sem texto", async () => {
    const whatsapp = numero();
    const id = await cadastrar({ nome: "Sem Mensagem", whatsapp });
    await periodo(id, "2026-10-01", "2026-10-31");
    await banco.db
      .update(mensagensProntas)
      .set({ ativa: false })
      .where(eq(mensagensProntas.finalidade, "retorno"));
    try {
      const valor = ok(
        await prepararContato(
          banco.db,
          { alunoIds: [id], lista: "vencido" },
          HOJE,
        ),
      );
      expect(valor).toMatchObject({
        url: `https://wa.me/${whatsapp}`,
        texto: null,
        mensagemId: null,
      });
    } finally {
      await banco.db
        .update(mensagensProntas)
        .set({ ativa: true })
        .where(eq(mensagensProntas.nome, "Convite para voltar"));
    }
  });
});

describe("registrarContato e resultado", () => {
  it("grava uma linha por aluno com o mesmo grupo", async () => {
    const { bruno, lia, carla, carlaId } = await irmaos();
    const valor = ok(
      await registrarContato(
        banco.db,
        { alunoIds: [bruno, lia], lista: "vencido", feitoPor: adm.id },
        HOJE,
      ),
    );
    expect(valor.url.startsWith(`https://wa.me/${carla}?text=`)).toBe(true);
    const linhas = await banco.db
      .select()
      .from(contatos)
      .where(eq(contatos.grupoId, valor.grupoId));
    expect(linhas).toHaveLength(2);
    expect(new Set(linhas.map((l) => l.alunoId))).toEqual(
      new Set([bruno, lia]),
    );
    const [mensagem] = await banco.db
      .select()
      .from(mensagensProntas)
      .where(eq(mensagensProntas.nome, "Convite para voltar"));
    for (const l of linhas) {
      expect(l).toMatchObject({
        pessoaContatoId: carlaId,
        whatsapp: carla,
        lista: "vencido",
        mensagemId: mensagem.id,
        texto: textoDoLink(valor.url),
        criadoPor: adm.id,
        resultado: null,
      });
    }
    expect(linhas[0].criadoEm.getTime()).toBe(linhas[1].criadoEm.getTime());
  });

  it("não grava nada quando o contato não pode ser feito", async () => {
    const a = await cadastrar({ nome: "Ana Três", whatsapp: numero() });
    const b = await cadastrar({ nome: "Bia Quatro", whatsapp: numero() });
    expect(
      erros(
        await registrarContato(
          banco.db,
          { alunoIds: [a, b], lista: "vencido", feitoPor: adm.id },
          HOJE,
        ),
      ),
    ).toEqual({ _: "Esses alunos não têm o mesmo contato." });
    const linhas = await banco.db
      .select()
      .from(contatos)
      .where(eq(contatos.alunoId, a));
    expect(linhas).toHaveLength(0);
  });

  it("não quer contato marca o grupo todo e bloqueia a pessoa uma vez só", async () => {
    const { bruno, lia, carlaId } = await irmaos();
    const { grupoId } = ok(
      await registrarContato(
        banco.db,
        { alunoIds: [bruno, lia], lista: "vencido", feitoPor: adm.id },
        HOJE,
      ),
    );
    const outra = await criarAdministracao(banco.db);
    ok(
      await marcarResultado(banco.db, {
        grupoId,
        resultado: "nao_quer_contato",
        feitoPor: outra.id,
      }),
    );
    const linhas = await banco.db
      .select()
      .from(contatos)
      .where(eq(contatos.grupoId, grupoId));
    for (const l of linhas) {
      expect(l.resultado).toBe("nao_quer_contato");
      expect(l.resultadoPor).toBe(outra.id);
      expect(l.resultadoEm).toBeInstanceOf(Date);
    }
    const bloqueios = () =>
      banco.db
        .select()
        .from(bloqueiosContato)
        .where(eq(bloqueiosContato.pessoaId, carlaId));
    expect(await bloqueios()).toHaveLength(1);
    expect((await bloqueios())[0]).toMatchObject({
      marcadoPor: outra.id,
      desfeitoEm: null,
    });

    // De novo (pelo resultado ou pela ficha): nenhum bloqueio a mais.
    ok(
      await marcarResultado(banco.db, {
        grupoId,
        resultado: "nao_quer_contato",
        feitoPor: adm.id,
      }),
    );
    ok(
      await marcarNaoQuerContato(banco.db, {
        pessoaId: carlaId,
        feitoPor: adm.id,
      }),
    );
    expect(await bloqueios()).toHaveLength(1);

    ok(
      await desfazerNaoQuerContato(banco.db, {
        pessoaId: carlaId,
        feitoPor: adm.id,
      }),
    );
    const [desfeito] = await bloqueios();
    expect(desfeito.desfeitoPor).toBe(adm.id);
    expect(desfeito.desfeitoEm).toBeInstanceOf(Date);
    const abertos = await banco.db
      .select()
      .from(bloqueiosContato)
      .where(
        and(
          eq(bloqueiosContato.pessoaId, carlaId),
          isNull(bloqueiosContato.desfeitoEm),
        ),
      );
    expect(abertos).toHaveLength(0);

    // Marcar de novo depois de desfeito abre outro bloqueio.
    ok(
      await marcarNaoQuerContato(banco.db, {
        pessoaId: carlaId,
        feitoPor: adm.id,
      }),
    );
    expect(await bloqueios()).toHaveLength(2);
  });

  it("o resultado pode ser trocado e guarda o último", async () => {
    const id = await cadastrar({ nome: "Troca Resultado", whatsapp: numero() });
    await periodo(id, "2026-10-01", "2026-10-31");
    const { grupoId } = ok(
      await registrarContato(
        banco.db,
        { alunoIds: [id], lista: "vencido", feitoPor: adm.id },
        HOJE,
      ),
    );
    ok(
      await marcarResultado(banco.db, {
        grupoId,
        resultado: "vai_pensar",
        feitoPor: adm.id,
      }),
    );
    ok(
      await marcarResultado(banco.db, {
        grupoId,
        resultado: "vai_renovar",
        feitoPor: adm.id,
      }),
    );
    const [linha] = await banco.db
      .select()
      .from(contatos)
      .where(eq(contatos.grupoId, grupoId));
    expect(linha.resultado).toBe("vai_renovar");
    const bloqueios = await banco.db
      .select()
      .from(bloqueiosContato)
      .where(eq(bloqueiosContato.pessoaId, id));
    expect(bloqueios).toHaveLength(0);
  });

  it("resultado fora da lista e grupo inexistente dão erro", async () => {
    const id = await cadastrar({ nome: "Talvez Silva", whatsapp: numero() });
    const { grupoId } = ok(
      await registrarContato(
        banco.db,
        { alunoIds: [id], lista: "ficha", feitoPor: adm.id },
        HOJE,
      ),
    );
    expect(
      erros(
        await marcarResultado(banco.db, {
          grupoId,
          resultado: "talvez",
          feitoPor: adm.id,
        }),
      ),
    ).toEqual({ resultado: "Escolha um resultado da lista." });
    for (const outro of ["xyz", "00000000-0000-4000-8000-000000000000"]) {
      expect(
        erros(
          await marcarResultado(banco.db, {
            grupoId: outro,
            resultado: "vai_pensar",
            feitoPor: adm.id,
          }),
        ),
      ).toEqual({ _: "Contato não encontrado." });
    }
  });

  it("marcar ou desfazer pessoa inexistente dá erro", async () => {
    for (const pessoaId of ["xyz", "00000000-0000-4000-8000-000000000000"]) {
      expect(
        erros(
          await marcarNaoQuerContato(banco.db, { pessoaId, feitoPor: adm.id }),
        ),
      ).toEqual({ _: "Pessoa não encontrada." });
    }
    expect(
      erros(
        await desfazerNaoQuerContato(banco.db, {
          pessoaId: "xyz",
          feitoPor: adm.id,
        }),
      ),
    ).toEqual({ _: "Pessoa não encontrada." });
  });
});
