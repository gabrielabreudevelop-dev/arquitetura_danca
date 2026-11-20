"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { ehUuid } from "@/servidor/cadastros/comum";
import {
  alternarEsgotado,
  excluirEvento,
  salvarEvento,
} from "@/servidor/cadastros/eventos";
import type { EstadoFormulario } from "../_formulario/estado";
import { lerTexto } from "../_formulario/ler-texto";

/** Páginas públicas e do painel que mostram eventos. */
function atualizarPaginas() {
  revalidatePath("/");
  revalidatePath("/eventos", "layout");
  revalidatePath("/painel/eventos", "layout");
}

export async function salvarEventoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const dados = {
    titulo: lerTexto(form, "titulo"),
    slug: lerTexto(form, "slug"),
    inicio: lerTexto(form, "inicio"),
    fim: lerTexto(form, "fim"),
    local: lerTexto(form, "local"),
    preco: lerTexto(form, "preco"),
    linkIngresso: lerTexto(form, "linkIngresso"),
    descricao: lerTexto(form, "descricao"),
    publicado: form.get("publicado") === "on",
    esgotado: form.get("esgotado") === "on",
    removerCapa: form.get("removerCapa") === "on",
  };
  // O formulário devolve o que foi digitado (o arquivo escolhido não volta).
  const valores = {
    ...dados,
    publicado: dados.publicado ? "on" : "",
    esgotado: dados.esgotado ? "on" : "",
    removerCapa: dados.removerCapa ? "on" : "",
  };
  if (id && !ehUuid(id)) {
    return { erros: { _: "Evento não encontrado." }, valores };
  }

  // Um campo de arquivo vazio chega como File sem nome e com tamanho 0: sem capa nova.
  const arquivo = form.get("capa");
  const capa =
    arquivo instanceof File && arquivo.size > 0
      ? {
          bytes: new Uint8Array(await arquivo.arrayBuffer()),
          tipo: arquivo.type,
        }
      : null;

  const resultado = await salvarEvento(obterBanco(), {
    ...dados,
    id: id || undefined,
    capa,
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  atualizarPaginas();
  redirect("/painel/eventos");
}

/** Marca ou reabre os ingressos direto da lista, sem abrir o formulário. */
export async function alternarEsgotadoAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  if (!ehUuid(id)) return;
  await alternarEsgotado(obterBanco(), id);
  atualizarPaginas();
}

/** Sem erro, volta para a lista; evento publicado volta para a edição com o aviso. */
export async function excluirEventoAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  if (!ehUuid(id)) redirect("/painel/eventos");
  const resultado = await excluirEvento(obterBanco(), id);
  if (!resultado.ok) redirect(`/painel/eventos/${id}?erro=publicado`);
  atualizarPaginas();
  redirect("/painel/eventos");
}
