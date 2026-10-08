export default function handler(req, res) {
  // Configuração de cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { categoria } = req.body || {};

  // Algoritmo de decisão Serverless no Backend
  let slaHoras = 48;
  let prioridadeCalculada = 'Baixa';
  let acaoRecomendada = 'Triagem de rotina em até 2 dias úteis.';

  if (categoria === 'Segurança') {
    slaHoras = 4;
    prioridadeCalculada = 'Crítica';
    acaoRecomendada = 'Acionar equipe de campo e patrulha com urgência.';
  } else if (categoria === 'Infraestrutura') {
    slaHoras = 24;
    prioridadeCalculada = 'Alta';
    acaoRecomendada = 'Despachar equipe técnica de manutenção urbana.';
  } else if (categoria === 'Limpeza Urbana') {
    slaHoras = 36;
    prioridadeCalculada = 'Média';
    acaoRecomendada = 'Incluir local na rota do próximo turno de saneamento.';
  }

  return res.status(200).json({
    sucesso: true,
    timestamp: new Date().toISOString(),
    categoriaAnalizada: categoria || 'Geral',
    slaSugeridoHoras: slaHoras,
    prioridadeSugerida: prioridadeCalculada,
    acaoRecomendada: acaoRecomendada,
    mensagem: 'SLA e nivel de severidade calculados com sucesso via Nhost Cloud Function.'
  });
}