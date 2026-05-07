# Requisitos Principais do Sistema

## Regra principal

Este sistema deve ser construído para continuar funcionando mesmo com informacoes incompletas.

Se algum dado do lote, mercado, FIPE, documento ou foto nao estiver disponivel, o sistema deve:

1. Salvar imediatamente tudo o que estiver disponivel.
2. Marcar cada campo ausente como pendente.
3. Permitir edicao posterior dos dados pendentes.
4. Nunca interromper o fluxo por falta de informacao.

## Implicacoes funcionais

- O cadastro e a atualizacao de registros devem aceitar persistencia parcial.
- Campos ausentes nao devem bloquear criacao, importacao ou avancos no processo.
- O sistema deve exibir claramente quais informacoes estao pendentes.
- Deve existir um mecanismo simples para revisao e complemento posterior dos dados.
- Integracoes externas que falharem ou retornarem dados incompletos devem gerar pendencias, nao erro bloqueante.

## Regra de implementacao

Ao modelar backend, frontend, banco de dados e automacoes, a regra padrao deve ser:

"prosseguir com o que houver, registrar pendencias e permitir correcao depois".
