/**
 * Dados fixos do estúdio. É o único lugar do código onde nome, contatos,
 * endereço e horário de funcionamento aparecem. Trocar aqui quando mudarem.
 */
export const ESTUDIO = {
  nome: "Arquitetura da Dança",
  instagram: {
    usuario: "@arquiteturadadanca",
    url: "https://www.instagram.com/arquiteturadadanca/",
  },
  whatsapp: {
    numero: "5527999891561",
    exibicao: "(27) 99989-1561",
  },
  endereco:
    "R. Antônio Guilherme do Nascimento, 173 · Jardim Camburi, Vitória/ES",
  funcionamento: "seg a qui, 14h às 21h · sex, 17h às 20h30",
  site: "https://arquiteturadadanca.com.br/",
} as const;
