import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, expect, it } from "vitest";
import { eventos, imagens } from "@/servidor/banco/esquema";
import {
  alternarEsgotado,
  excluirEvento,
  listarEventosPainel,
  obterEventoPainel,
  salvarEvento,
} from "@/servidor/cadastros/eventos";
import { criarBancoDeTeste } from "../apoio/banco";
import { criarEvento } from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

const base = {
  titulo: "Baile de Dezembro",
  inicio: "2026-12-13T21:00",
  publicado: false,
  esgotado: false,
};

let contador = 0;
/** Dados válidos com título e slug únicos (o banco de teste é compartilhado entre os testes). */
function dados(extra: Partial<Parameters<typeof salvarEvento>[1]> = {}) {
  contador += 1;
  return {
    ...base,
    titulo: `Baile ${contador}`,
    slug: `baile-${contador}`,
    ...extra,
  };
}

async function png(cor = "#2c3e50") {
  const bytes = await sharp({
    create: { width: 300, height: 200, channels: 3, background: cor },
  })
    .png()
    .toBuffer();
  return { bytes: new Uint8Array(bytes), tipo: "image/png" };
}

async function evento(id: string) {
  const [linha] = await banco.db
    .select()
    .from(eventos)
    .where(eq(eventos.id, id));
  return linha;
}

async function imagemExiste(id: string | null) {
  if (!id) return false;
  const linhas = await banco.db
    .select()
    .from(imagens)
    .where(eq(imagens.id, id));
  return linhas.length > 0;
}

async function total(tabela: typeof imagens | typeof eventos) {
  return (await banco.db.select().from(tabela)).length;
}

it("cria o evento com o horário de São Paulo e o slug do título", async () => {
  const r = await salvarEvento(banco.db, {
    titulo: "Baile de Dezembro",
    inicio: "2026-12-13T21:00",
    publicado: false,
    esgotado: false,
  });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const e = await evento(r.valor.id);
  expect(e.inicio.toISOString()).toBe("2026-12-14T00:00:00.000Z");
  expect(e.slug).toBe("baile-de-dezembro");
  expect(e.fim).toBeNull();
  expect(e.publicado).toBe(false);
  expect(e.primeiraPublicacaoEm).toBeNull();
});

it("recusa slug repetido", async () => {
  const r = await salvarEvento(banco.db, dados({ slug: "baile-de-dezembro" }));
  expect(r).toEqual({
    ok: false,
    erros: { slug: "Esse endereço já está em uso." },
  });
});

it("recusa fim antes do início", async () => {
  const r = await salvarEvento(
    banco.db,
    dados({ inicio: "2026-12-13T21:00", fim: "2026-12-13T20:00" }),
  );
  expect(r).toEqual({
    ok: false,
    erros: { fim: "O fim precisa ser depois do início." },
  });
});

it("recusa link de ingresso sem https://", async () => {
  const r = await salvarEvento(
    banco.db,
    dados({ linkIngresso: "sympla.com.br/x" }),
  );
  expect(r).toEqual({
    ok: false,
    erros: { linkIngresso: "Use um link completo, começando com https://." },
  });
});

it("recusa título vazio e início inválido", async () => {
  const r = await salvarEvento(banco.db, dados({ titulo: "  ", inicio: "" }));
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.erros.titulo).toBe("Informe o título.");
  expect(r.erros.inicio).toBe("Informe a data e a hora de início.");
});

it("grava os campos opcionais e os apaga quando vêm vazios", async () => {
  const r = await salvarEvento(
    banco.db,
    dados({
      fim: "2026-12-14T02:00",
      local: " Salão do estúdio ",
      preco: "R$ 35",
      descricao: "Linha 1\nLinha 2",
      linkIngresso: "https://sympla.com.br/x",
    }),
  );
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  let e = await evento(r.valor.id);
  expect(e.fim?.toISOString()).toBe("2026-12-14T05:00:00.000Z");
  expect(e.local).toBe("Salão do estúdio");
  expect(e.descricao).toBe("Linha 1\nLinha 2");
  expect(e.linkIngresso).toBe("https://sympla.com.br/x");

  await salvarEvento(banco.db, {
    ...base,
    id: r.valor.id,
    titulo: "Sem extras",
    slug: e.slug,
    fim: "",
    local: "",
    preco: "",
    descricao: "",
    linkIngresso: "",
  });
  e = await evento(r.valor.id);
  expect(e.fim).toBeNull();
  expect(e.local).toBeNull();
  expect(e.preco).toBeNull();
  expect(e.descricao).toBeNull();
  expect(e.linkIngresso).toBeNull();
});

it("publicar preenche primeiraPublicacaoEm; o slug fica fixo depois disso", async () => {
  const criado = await salvarEvento(banco.db, dados({ slug: "fixo-depois" }));
  if (!criado.ok) throw new Error("falhou");
  const id = criado.valor.id;

  // Nunca publicado: aceita trocar o slug.
  let r = await salvarEvento(banco.db, dados({ id, slug: "ainda-livre" }));
  expect(r.ok).toBe(true);
  expect((await evento(id)).slug).toBe("ainda-livre");

  r = await salvarEvento(
    banco.db,
    dados({ id, slug: "ainda-livre", publicado: true }),
  );
  expect(r.ok).toBe(true);
  const publicado = await evento(id);
  expect(publicado.primeiraPublicacaoEm).toBeInstanceOf(Date);

  // Volta a rascunho: o slug enviado é ignorado e a data da primeira publicação permanece.
  r = await salvarEvento(
    banco.db,
    dados({ id, slug: "outro", publicado: false }),
  );
  expect(r.ok).toBe(true);
  const rascunho = await evento(id);
  expect(rascunho.slug).toBe("ainda-livre");
  expect(rascunho.publicado).toBe(false);
  expect(rascunho.primeiraPublicacaoEm?.getTime()).toBe(
    publicado.primeiraPublicacaoEm?.getTime(),
  );

  const lido = await obterEventoPainel(banco.db, id);
  expect(lido?.slugEditavel).toBe(false);
  const novo = await salvarEvento(banco.db, dados({ slug: "novo-livre" }));
  if (!novo.ok) throw new Error("falhou");
  expect((await obterEventoPainel(banco.db, novo.valor.id))?.slugEditavel).toBe(
    true,
  );
});

it("editar um evento inexistente devolve erro geral", async () => {
  const r = await salvarEvento(
    banco.db,
    dados({ id: "00000000-0000-4000-8000-000000000000" }),
  );
  expect(r).toEqual({ ok: false, erros: { _: "Evento não encontrado." } });
  expect(
    await obterEventoPainel(banco.db, "00000000-0000-4000-8000-000000000000"),
  ).toBeNull();
});

it("capa inválida não grava nada", async () => {
  const antes = await total(imagens);
  const eventosAntes = await total(eventos);
  const r = await salvarEvento(
    banco.db,
    dados({
      capa: {
        bytes: new TextEncoder().encode("isto não é uma imagem"),
        tipo: "image/png",
      },
    }),
  );
  expect(r).toEqual({
    ok: false,
    erros: { capa: "Envie uma imagem JPEG, PNG ou WebP." },
  });
  expect(await total(imagens)).toBe(antes);
  expect(await total(eventos)).toBe(eventosAntes);
});

it("capa inválida convive com os outros erros do formulário", async () => {
  const r = await salvarEvento(
    banco.db,
    dados({
      titulo: "",
      capa: { bytes: new TextEncoder().encode("x"), tipo: "image/png" },
    }),
  );
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.erros.titulo).toBe("Informe o título.");
  expect(r.erros.capa).toBe("Envie uma imagem JPEG, PNG ou WebP.");
});

it("trocar a capa apaga a imagem antiga; removerCapa limpa e apaga", async () => {
  const criado = await salvarEvento(banco.db, dados({ capa: await png() }));
  if (!criado.ok) throw new Error("falhou");
  const id = criado.valor.id;
  const primeira = (await evento(id)).capaId;
  expect(await imagemExiste(primeira)).toBe(true);

  const troca = await salvarEvento(
    banco.db,
    dados({ id, slug: (await evento(id)).slug, capa: await png("#c0392b") }),
  );
  expect(troca.ok).toBe(true);
  const segunda = (await evento(id)).capaId;
  expect(segunda).not.toBe(primeira);
  expect(await imagemExiste(primeira)).toBe(false);
  expect(await imagemExiste(segunda)).toBe(true);

  // Sem capa nova e sem removerCapa, a atual continua.
  await salvarEvento(
    banco.db,
    dados({ id, slug: (await evento(id)).slug, capa: null }),
  );
  expect((await evento(id)).capaId).toBe(segunda);

  const remocao = await salvarEvento(
    banco.db,
    dados({ id, slug: (await evento(id)).slug, removerCapa: true }),
  );
  expect(remocao.ok).toBe(true);
  expect((await evento(id)).capaId).toBeNull();
  expect(await imagemExiste(segunda)).toBe(false);
});

it("erro depois de processar a capa não deixa imagem órfã", async () => {
  await salvarEvento(banco.db, dados({ slug: "ocupado" }));
  const antes = await total(imagens);
  const r = await salvarEvento(
    banco.db,
    dados({ slug: "ocupado", capa: await png() }),
  );
  expect(r).toEqual({
    ok: false,
    erros: { slug: "Esse endereço já está em uso." },
  });
  expect(await total(imagens)).toBe(antes);
});

it("slug vazio na criação, com capa, não deixa imagem órfã", async () => {
  const antes = await total(imagens);
  const r = await salvarEvento(
    banco.db,
    dados({ titulo: "!!!", slug: "", capa: await png() }),
  );
  expect(r).toEqual({
    ok: false,
    erros: { slug: "Informe um endereço com letras ou números." },
  });
  expect(await total(imagens)).toBe(antes);
});

it("editar evento inexistente ou limpar o slug, com capa, não deixa imagem órfã", async () => {
  const antes = await total(imagens);
  const inexistente = await salvarEvento(
    banco.db,
    dados({
      id: "00000000-0000-4000-8000-000000000000",
      capa: await png(),
    }),
  );
  expect(inexistente).toEqual({
    ok: false,
    erros: { _: "Evento não encontrado." },
  });
  const naoUuid = await salvarEvento(
    banco.db,
    dados({ id: "lixo", capa: await png() }),
  );
  expect(naoUuid.ok).toBe(false);

  const criado = await salvarEvento(banco.db, dados());
  if (!criado.ok) throw new Error("falhou");
  const semSlug = await salvarEvento(
    banco.db,
    dados({ id: criado.valor.id, titulo: "???", slug: "", capa: await png() }),
  );
  expect(semSlug).toEqual({
    ok: false,
    erros: { slug: "Informe um endereço com letras ou números." },
  });
  expect(await total(imagens)).toBe(antes);
});

it("alternarEsgotado inverte o valor a cada chamada", async () => {
  const e = await criarEvento(banco.db);
  expect(await alternarEsgotado(banco.db, e.id)).toEqual({
    ok: true,
    valor: { esgotado: true },
  });
  expect(await alternarEsgotado(banco.db, e.id)).toEqual({
    ok: true,
    valor: { esgotado: false },
  });
  expect(
    await alternarEsgotado(banco.db, "00000000-0000-4000-8000-000000000000"),
  ).toEqual({ ok: false, erros: { _: "Evento não encontrado." } });
});

it("não exclui evento publicado", async () => {
  const e = await criarEvento(banco.db);
  expect(await excluirEvento(banco.db, e.id)).toEqual({
    ok: false,
    erros: { _: "Volte o evento para rascunho antes de excluir." },
  });
  expect(await evento(e.id)).toBeDefined();
});

it("exclui o rascunho e a capa dele", async () => {
  const criado = await salvarEvento(banco.db, dados({ capa: await png() }));
  if (!criado.ok) throw new Error("falhou");
  const capaId = (await evento(criado.valor.id)).capaId;
  expect(await excluirEvento(banco.db, criado.valor.id)).toEqual({
    ok: true,
    valor: null,
  });
  expect(await evento(criado.valor.id)).toBeUndefined();
  expect(await imagemExiste(capaId)).toBe(false);
});

it("excluir um evento que não existe devolve erro geral", async () => {
  expect(
    await excluirEvento(banco.db, "00000000-0000-4000-8000-000000000000"),
  ).toEqual({ ok: false, erros: { _: "Evento não encontrado." } });
});

it("lista os próximos por início e depois os passados, do mais recente", async () => {
  const limpo = await criarBancoDeTeste();
  try {
    const agora = new Date("2026-12-01T12:00:00Z");
    const dia = 86_400_000;
    const passadoAntigo = await criarEvento(limpo.db, {
      inicio: new Date(agora.getTime() - 10 * dia),
    });
    const passadoRecente = await criarEvento(limpo.db, {
      inicio: new Date(agora.getTime() - 2 * dia),
    });
    const longe = await criarEvento(limpo.db, {
      inicio: new Date(agora.getTime() + 20 * dia),
      esgotado: true,
    });
    const perto = await criarEvento(limpo.db, {
      inicio: new Date(agora.getTime() + 3 * dia),
      publicado: false,
      primeiraPublicacaoEm: null,
    });
    // Começou ontem e termina amanhã: ainda não passou.
    const emCurso = await criarEvento(limpo.db, {
      inicio: new Date(agora.getTime() - dia),
      fim: new Date(agora.getTime() + dia),
    });

    const lista = await listarEventosPainel(limpo.db, agora);
    expect(lista.map((x) => x.id)).toEqual([
      emCurso.id,
      perto.id,
      longe.id,
      passadoRecente.id,
      passadoAntigo.id,
    ]);
    const porId = new Map(lista.map((x) => [x.id, x]));
    expect(porId.get(emCurso.id)?.passou).toBe(false);
    expect(porId.get(perto.id)).toMatchObject({
      passou: false,
      publicado: false,
    });
    expect(porId.get(longe.id)).toMatchObject({
      passou: false,
      esgotado: true,
    });
    expect(porId.get(passadoRecente.id)?.passou).toBe(true);
    expect(porId.get(passadoAntigo.id)?.passou).toBe(true);
  } finally {
    await limpo.encerrar();
  }
});
