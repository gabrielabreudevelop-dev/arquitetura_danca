import type { DadosAluno } from "@/servidor/alunos/cadastro";
import { type DataIso, ehDataIso, ehMenor } from "@/servidor/alunos/datas";
import { lerTexto } from "../_formulario/ler-texto";

const CAMPOS = [
  "nome",
  "nascimento",
  "whatsapp",
  "email",
  "instagram",
] as const;
const CAMPOS_RESPONSAVEL = [
  "responsavel.nome",
  "responsavel.whatsapp",
  "responsavel.email",
] as const;

/**
 * Traduz o formulário de aluno para os dados do serviço. `responsavelId`
 * (pessoa que já existe) vira `responsavel.pessoaId`, salvo se veio
 * `responsavelNovo` ("Cadastrar outra pessoa"). `valores` devolve o que foi
 * digitado, para o formulário não esvaziar (com `responsavelExistenteNome`,
 * o nome da pessoa escolhida, quando há `responsavelId`).
 */
export function lerDadosAluno(form: FormData): {
  dados: DadosAluno & { turmaIds: string[] };
  valores: Record<string, string>;
} {
  const valores: Record<string, string> = {};
  for (const c of [...CAMPOS, ...CAMPOS_RESPONSAVEL])
    valores[c] = lerTexto(form, c);
  const turmaIds = form.getAll("turmaIds").map(String).filter(Boolean);
  valores.turmaIds = turmaIds.join(",");

  const novo = lerTexto(form, "responsavelNovo") === "1";
  const pessoaId = novo ? "" : lerTexto(form, "responsavelId").trim();
  if (novo) valores.responsavelNovo = "1";
  if (pessoaId) {
    valores.responsavelId = pessoaId;
    // Nome de quem já está cadastrado, só para a tela mostrar a escolha.
    const nome = lerTexto(form, "responsavelExistenteNome");
    if (nome) valores.responsavelExistenteNome = nome;
  }

  return {
    dados: {
      nome: valores.nome,
      nascimento: valores.nascimento,
      whatsapp: valores.whatsapp,
      email: valores.email,
      instagram: valores.instagram,
      responsavel: pessoaId
        ? { pessoaId }
        : {
            nome: valores["responsavel.nome"],
            whatsapp: valores["responsavel.whatsapp"],
            email: valores["responsavel.email"],
            novo,
          },
      confirmarWhatsappRepetido:
        lerTexto(form, "confirmarWhatsappRepetido") === "1",
      turmaIds,
    },
    valores,
  };
}

/**
 * Menor com "Cadastrar outro responsável" marcado (campo `responsavelId`
 * presente e vazio) e sem nenhum dado do novo responsável: devolve os erros
 * dos campos. Sem isso, o serviço manteria o responsável atual em silêncio.
 */
export function faltaResponsavelEscolhido(
  form: FormData,
  hoje: DataIso,
): Record<string, string> | null {
  const nascimento = lerTexto(form, "nascimento").trim();
  const menor = ehDataIso(nascimento) && ehMenor(nascimento, hoje);
  const pediuOutro =
    form.has("responsavelId") && !lerTexto(form, "responsavelId").trim();
  const vazio = CAMPOS_RESPONSAVEL.every((c) => !lerTexto(form, c).trim());
  if (!menor || !pediuOutro || !vazio) return null;
  return {
    "responsavel.nome": "Informe o responsável.",
    "responsavel.whatsapp": "Informe o WhatsApp do responsável.",
  };
}

/** Letras, números, hífen e barra simples depois de `/painel/alunos/`. */
const CAMINHO_DEPOIS = /^\/painel\/alunos\/[A-Za-z0-9-]+(\/[A-Za-z0-9-]+)*$/;

/**
 * Para onde voltar depois de cadastrar (`?depois=` do formulário de novo
 * aluno). Só caminhos dentro de `/painel/alunos/`, sem `//`, `..`, esquema,
 * consulta nem âncora; qualquer outra coisa vira `null`.
 */
export function lerDepois(valor: unknown): string | null {
  return typeof valor === "string" && CAMINHO_DEPOIS.test(valor) ? valor : null;
}

/** `depois` válido → `<depois>?para=<id>`; senão, a ficha do novo aluno. */
export function enderecoDepoisDoCadastro(
  depois: string,
  alunoId: string,
): string {
  const caminho = lerDepois(depois);
  return caminho
    ? `${caminho}?para=${encodeURIComponent(alunoId)}`
    : `/painel/alunos/${alunoId}`;
}
