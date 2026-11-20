"use client";

import { type ChangeEvent, useActionState, useState } from "react";
import { TAMANHO_MAXIMO_CAPA } from "@/servidor/imagens/limite-capa";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { Campo } from "../_formulario/campo";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import { salvarEventoAcao } from "./acoes";

type Evento = {
  id: string;
  titulo: string;
  slug: string;
  slugEditavel: boolean;
  /** Valores no formato de `datetime-local`, já em horário de São Paulo. */
  inicio: string;
  fim: string;
  local: string;
  preco: string;
  linkIngresso: string;
  descricao: string;
  capaId: string | null;
  publicado: boolean;
  esgotado: boolean;
};

const MENSAGEM_CAPA_GRANDE = "A imagem pode ter até 10 MB.";

/** Formulário de evento: novo (sem `evento`) ou edição. Com erro, mantém o que foi digitado. */
export function FormularioEvento({ evento }: { evento?: Evento }) {
  const [estado, acao] = useActionState(salvarEventoAcao, ESTADO_INICIAL);
  const [erroCapaCliente, setErroCapaCliente] = useState<string>();
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const slugFixo = evento ? !evento.slugEditavel : false;
  const temCapa = Boolean(evento?.capaId);

  /**
   * Confere o tamanho antes de enviar: acima do limite o Next recusa o corpo da
   * requisição antes de a action rodar, e a pessoa não veria o motivo.
   */
  function conferirCapa(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo && arquivo.size > TAMANHO_MAXIMO_CAPA) {
      e.target.value = "";
      setErroCapaCliente(MENSAGEM_CAPA_GRANDE);
    } else {
      setErroCapaCliente(undefined);
    }
  }

  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      {evento && <input type="hidden" name="id" value={evento.id} />}
      <Campo
        nome="titulo"
        rotulo="Título"
        valor={v?.titulo ?? evento?.titulo ?? ""}
        erro={erros.titulo}
        atributos={{ autoComplete: "off" }}
        obrigatorio
      />
      <Campo
        nome="slug"
        rotulo="Endereço"
        valor={slugFixo ? evento?.slug : (v?.slug ?? evento?.slug ?? "")}
        erro={erros.slug}
        ajuda={
          slugFixo
            ? "O endereço fica fixo depois da primeira publicação, para não quebrar links já compartilhados."
            : "Letras minúsculas, números e hífens. Se ficar vazio, usamos o título."
        }
        atributos={{
          autoCapitalize: "none",
          spellCheck: false,
          disabled: slugFixo,
        }}
      />
      <Campo
        nome="inicio"
        rotulo="Início"
        tipo="datahora"
        valor={v?.inicio ?? evento?.inicio ?? ""}
        erro={erros.inicio}
        obrigatorio
      />
      <Campo
        nome="fim"
        rotulo="Fim (opcional)"
        tipo="datahora"
        valor={v?.fim ?? evento?.fim ?? ""}
        erro={erros.fim}
      />
      <Campo
        nome="local"
        rotulo="Local"
        valor={v?.local ?? evento?.local ?? ""}
        erro={erros.local}
      />
      <Campo
        nome="preco"
        rotulo="Preço"
        valor={v?.preco ?? evento?.preco ?? ""}
        erro={erros.preco}
        ajuda="Ex.: R$ 35 antecipado · R$ 40 no dia"
      />
      <Campo
        nome="linkIngresso"
        rotulo="Link de ingresso"
        tipo="url"
        valor={v?.linkIngresso ?? evento?.linkIngresso ?? ""}
        erro={erros.linkIngresso}
        ajuda="Se vazio, o botão abre o WhatsApp do estúdio com uma mensagem pronta."
        atributos={{ autoCapitalize: "none", spellCheck: false }}
      />
      <Campo
        nome="descricao"
        rotulo="Descrição"
        tipo="area"
        valor={v?.descricao ?? evento?.descricao ?? ""}
        erro={erros.descricao}
        atributos={{ rows: 6 }}
      />

      <div className="flex flex-col gap-4">
        {temCapa && (
          // biome-ignore lint/performance/noImgElement: rota própria que serve os bytes do banco; sem otimização do Next.
          <img
            src={`/capas/${evento?.capaId}`}
            alt={`Capa atual de ${evento?.titulo}`}
            className="max-h-80 w-full rounded-sm object-contain object-left"
          />
        )}
        <Campo
          nome="capa"
          rotulo={temCapa ? "Trocar capa" : "Capa"}
          tipo="arquivo"
          erro={erroCapaCliente ?? erros.capa}
          ajuda="JPEG, PNG ou WebP, até 10 MB. A imagem é mostrada inteira, sem cortes."
          atributos={{ accept: "image/jpeg,image/png,image/webp" }}
          aoMudar={conferirCapa}
        />
        {temCapa && (
          <Campo
            nome="removerCapa"
            rotulo="Remover capa"
            tipo="caixa"
            marcado={v?.removerCapa === "on"}
          />
        )}
      </div>

      <Campo
        nome="esgotado"
        rotulo="Ingressos esgotados"
        tipo="caixa"
        marcado={v ? v.esgotado === "on" : (evento?.esgotado ?? false)}
      />
      <Campo
        nome="publicado"
        rotulo="Publicado"
        tipo="caixa"
        ajuda="Só eventos publicados aparecem no site."
        marcado={v ? v.publicado === "on" : (evento?.publicado ?? false)}
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}
