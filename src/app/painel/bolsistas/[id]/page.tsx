import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  type DataIso,
  formatarDataCompleta,
  formatarDia,
  hojeEmSaoPaulo,
  idadeEm,
} from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { obterFichaBolsista } from "@/servidor/bolsistas/ficha";
import { ultimaMudanca } from "@/servidor/bolsistas/regras";
import { diasCurtos, ROTULOS_PREFERENCIA } from "@/servidor/bolsistas/textos";
import { MENSAGEM_RECENTE } from "@/servidor/contatos/contatos";
import { mensagemDoErro } from "@/servidor/contatos/pedido-abrir";
import { formatarWhatsapp } from "@/servidor/pessoas/formatar";
import { textoDoResultado } from "../../alunos/textos";
import { BotaoWhatsapp } from "../../contatos/formularios";
import { textoDaFrequencia } from "../textos";
import { FormularioNaoQuerContatoBolsista } from "./formularios/contato";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";
const SECUNDARIO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo md:w-auto";
const LINK =
  "-mx-2 inline-flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4";
const SECAO = "flex flex-col gap-4 border-linha border-t pt-6";
const LINHA =
  "flex flex-col gap-1 border-linha border-b py-3 last:border-b-0 md:flex-row md:items-baseline md:gap-6";
const DATA = "text-pequeno text-texto-suave md:w-20 md:shrink-0";

/** "15/11", ou "15/11/2025" se for de outro ano. */
function diaDe(data: DataIso, hoje: DataIso): string {
  return data.slice(0, 4) === hoje.slice(0, 4)
    ? formatarDia(data)
    : formatarDataCompleta(data);
}

/** Dia de um instante em São Paulo. */
function diaDoInstante(em: Date, hoje: DataIso): string {
  return diaDe(hojeEmSaoPaulo(em), hoje);
}

/** Itens separados por " · ". */
function juntar(itens: ReactNode[]): ReactNode {
  return itens.map((item, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, sem reordenação
    <span key={i}>
      {i > 0 && " · "}
      {item}
    </span>
  ));
}

/** Título da seção com a ação dela ao lado (embaixo no celular). */
function Cabecalho({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <h2 id={id} className="text-base">
        {titulo}
      </h2>
      {children}
    </div>
  );
}

export default async function FichaBolsista({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  // A rota de abrir o WhatsApp volta com `?erro=<código>`; com `recente`,
  // outra pessoa da equipe chamou hoje depois do contato que a ficha mostrava.
  const { erro: erroBruto } = await searchParams;
  const erro = typeof erroBruto === "string" ? erroBruto : undefined;
  const confirmarContato = erro === "recente";
  const erroContato = confirmarContato ? null : mensagemDoErro(erro);
  const hoje = hojeEmSaoPaulo();
  const ficha = await obterFichaBolsista(obterBanco(), id, hoje);
  if (!ficha) notFound();
  const {
    bolsista: b,
    versoes,
    meses,
    presencas,
    historico,
    contatos,
    naoQuerContato,
  } = ficha;
  const base = `/painel/bolsistas/${b.id}`;
  const r = b.responsavel;
  const ultima = ultimaMudanca(b.historico);
  const [vigente, ...anteriores] = versoes;

  const dados: ReactNode[] = [
    b.nascimento
      ? `${idadeEm(b.nascimento, hoje)} anos`
      : "Sem data de nascimento",
  ];
  if (b.whatsapp)
    dados.push(
      <span className="whitespace-nowrap">{formatarWhatsapp(b.whatsapp)}</span>,
    );
  if (b.email) dados.push(<span className="break-words">{b.email}</span>);
  if (b.instagram)
    dados.push(
      <a
        href={`https://instagram.com/${b.instagram}`}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK}
      >
        @{b.instagram}
      </a>,
    );
  if (b.ativo) dados.push("ativo");

  const avisos: string[] = [];
  if (!b.ativo)
    avisos.push(
      ultima
        ? `Inativo desde ${diaDe(ultima.data, hoje)}. Não aparece na chamada nem na lista de quem está sem vir.`
        : "Inativo. Não aparece na chamada nem na lista de quem está sem vir.",
    );
  if (b.contato.usandoNumeroDoResponsavel)
    avisos.push(
      `Sem WhatsApp próprio — usando o de ${b.contato.nome} (responsável)`,
    );
  if (naoQuerContato)
    avisos.push(
      `Não quer contato desde ${diaDoInstante(naoQuerContato.em, hoje)}`,
    );

  // Quem recebe as mensagens e por que o WhatsApp pode não estar disponível.
  const contato = b.contato;
  const quemRecebe = contato.ehResponsavel
    ? `As mensagens vão para ${contato.nome} (responsável). A marca de não quer contato vale para todos com esse responsável.`
    : null;
  const motivoSemWhatsapp = !b.ativo
    ? "Bolsista inativo. Reative para chamar no WhatsApp."
    : naoQuerContato
      ? `${contato.nome} não quer contato. O WhatsApp volta quando alguém marcar que voltou a aceitar contato.`
      : !contato.whatsapp
        ? "Sem WhatsApp para chamar. Cadastre um número para usar o botão."
        : null;
  const visto = contatos[0]?.grupoId ?? null;

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-4">
        <Link href="/painel/bolsistas" className={`${LINK} self-start`}>
          Voltar para bolsistas
        </Link>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="break-words text-titulo">{b.nome}</h1>
          <div className="flex flex-col gap-4 md:flex-row">
            <Link href={`${base}/editar`} className={SECUNDARIO}>
              Editar
            </Link>
            <Link
              href={`${base}/situacao`}
              className={b.ativo ? SECUNDARIO : BOTAO}
            >
              {b.ativo ? "Inativar" : "Reativar"}
            </Link>
          </div>
        </div>
        <p className="text-texto-suave">{juntar(dados)}</p>
        <p>
          <span className="font-semibold">Preferência:</span>{" "}
          {ROTULOS_PREFERENCIA[b.preferencia]}
        </p>
        {r && (
          <p>
            <span className="font-semibold">Responsável:</span>{" "}
            {juntar(
              [
                r.nome,
                r.whatsapp && (
                  <span className="whitespace-nowrap">
                    {formatarWhatsapp(r.whatsapp)}
                  </span>
                ),
                r.email && <span className="break-words">{r.email}</span>,
              ].filter(Boolean),
            )}
          </p>
        )}
        {avisos.length > 0 && (
          <ul className="flex flex-col gap-1 bg-rosa-suave px-4 py-3">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </div>

      <section aria-labelledby="ficha-dias" className={SECAO}>
        <Cabecalho id="ficha-dias" titulo="Dias combinados">
          <Link href={`${base}/dias`} className={SECUNDARIO}>
            Alterar dias
          </Link>
        </Cabecalho>
        {vigente ? (
          <p>
            <span className="font-semibold">{diasCurtos(vigente.dias)}</span>
            <span className="text-texto-suave">
              {" "}
              · desde {diaDe(vigente.desde, hoje)}
            </span>
          </p>
        ) : (
          <p className="text-texto-suave">Sem dias combinados.</p>
        )}
        {anteriores.length > 0 && (
          <ul className="flex flex-col gap-1 text-pequeno text-texto-suave">
            {anteriores.map((v) => (
              <li key={v.desde}>
                Antes: {diasCurtos(v.dias)} ({diaDe(v.desde, hoje)} a{" "}
                {v.ate ? diaDe(v.ate, hoje) : "hoje"})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ficha-frequencia" className={SECAO}>
        <h2 id="ficha-frequencia" className="text-base">
          Frequência
        </h2>
        <p className="max-w-prose text-pequeno text-texto-suave">
          Dias combinados em que houve aula no estúdio, e em quantos o bolsista
          veio. Vindas em outros dias contam à parte.
        </p>
        <ul className="flex flex-col">
          {meses.map((m) => (
            <li key={m.mes} className={LINHA}>
              <span className="font-semibold md:w-20 md:shrink-0">{m.mes}</span>
              <span>{textoDaFrequencia(m)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ficha-presencas" className={SECAO}>
        <h2 id="ficha-presencas" className="text-base">
          Presenças recentes
        </h2>
        {presencas.length === 0 ? (
          <p className="max-w-prose text-texto-suave">
            Nenhuma presença registrada. As vindas aparecem aqui quando a
            chamada da turma é feita.
          </p>
        ) : (
          <ul className="flex flex-col">
            {presencas.map((p, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: duas turmas podem ter o mesmo rótulo no mesmo dia
                key={i}
                className={LINHA}
              >
                <span className={DATA}>{diaDe(p.data, hoje)}</span>
                <span className="min-w-0 flex-1 break-words">{p.rotulo}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ficha-contatos" className={SECAO}>
        <h2 id="ficha-contatos" className="text-base">
          Contatos
        </h2>
        {contatos.length === 0 ? (
          <p className="text-texto-suave">Nenhum contato registrado.</p>
        ) : (
          <ul className="flex flex-col">
            {contatos.map((c) => (
              <li key={`${c.grupoId}-${c.em.getTime()}`} className={LINHA}>
                <span className={DATA}>{diaDoInstante(c.em, hoje)}</span>
                <p className="min-w-0 flex-1 break-words">
                  {c.mensagem ?? "Contato"}
                  <span className="text-texto-suave"> · {c.por}</span>
                  {c.resultado && ` · ${textoDoResultado(c.resultado)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        {quemRecebe && (
          <p className="max-w-prose text-texto-suave">{quemRecebe}</p>
        )}
        {motivoSemWhatsapp && (
          <p className="max-w-prose">
            {motivoSemWhatsapp}
            {b.ativo && !naoQuerContato && (
              <>
                {" "}
                <Link href={`${base}/editar`} className={LINK}>
                  Editar cadastro
                </Link>
              </>
            )}
          </p>
        )}
        {erroContato && (
          <p role="alert" className="max-w-prose text-erro">
            {erroContato}
          </p>
        )}
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {!motivoSemWhatsapp && confirmarContato && (
            <div className="flex flex-col gap-2">
              <p role="alert" className="max-w-prose text-erro">
                {MENSAGEM_RECENTE}
              </p>
              <BotaoWhatsapp
                alunoIds={[b.id]}
                lista="ficha_bolsista"
                visto={visto}
                confirmar
                depois={base}
              >
                Chamar mesmo assim
              </BotaoWhatsapp>
            </div>
          )}
          {!motivoSemWhatsapp && !confirmarContato && (
            <BotaoWhatsapp
              alunoIds={[b.id]}
              lista="ficha_bolsista"
              visto={visto}
              depois={erroContato ? base : undefined}
            >
              Chamar no WhatsApp
            </BotaoWhatsapp>
          )}
          <FormularioNaoQuerContatoBolsista
            key={naoQuerContato ? "marcado" : "livre"}
            bolsistaId={b.id}
            marcado={naoQuerContato !== null}
          />
        </div>
      </section>

      <section aria-labelledby="ficha-historico" className={SECAO}>
        <h2 id="ficha-historico" className="text-base">
          Histórico
        </h2>
        {historico.length === 0 ? (
          <p className="text-texto-suave">Nada registrado ainda.</p>
        ) : (
          <ul className="flex flex-col">
            {historico.map((h, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: itens sem id próprio, em ordem fixa
                key={i}
                className={LINHA}
              >
                <span className={DATA}>{diaDoInstante(h.em, hoje)}</span>
                <p className="min-w-0 flex-1 break-words">
                  {h.texto}
                  <span className="text-texto-suave"> · {h.por}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
