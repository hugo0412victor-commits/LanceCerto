export function buildInterestedCustomerMessage(input: {
  customerName?: string;
  vehicleLabel: string;
  price?: number;
}) {
  return `Ola${input.customerName ? `, ${input.customerName}` : ""}! Seguem os detalhes do ${input.vehicleLabel}. Valor de referencia: ${input.price ? `R$ ${input.price.toLocaleString("pt-BR")}` : "a confirmar"}. Posso enviar mais fotos, documentos disponiveis e historico do projeto.`;
}

export function buildFollowUpMessage(input: {
  customerName?: string;
  vehicleLabel: string;
}) {
  return `Ola${input.customerName ? `, ${input.customerName}` : ""}! Passando para retomar nossa conversa sobre o ${input.vehicleLabel}. Se quiser, atualizo disponibilidade, condicoes e envio material complementar.`;
}

export function buildNegotiationMessage(input: {
  vehicleLabel: string;
  targetPrice?: number;
}) {
  return `Tenho margem para conduzir a negociacao do ${input.vehicleLabel}${input.targetPrice ? ` em torno de R$ ${input.targetPrice.toLocaleString("pt-BR")}` : ""}, mantendo transparencia sobre a condicao do veiculo e documentacao disponivel.`;
}

export function buildDocumentMessage(input: {
  customerName?: string;
  vehicleLabel: string;
}) {
  return `Ola${input.customerName ? `, ${input.customerName}` : ""}! Estou enviando os documentos disponiveis do ${input.vehicleLabel}. Se precisar de algum complemento, respondo assim que o arquivo ficar pronto ou for liberado.`;
}
