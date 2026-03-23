function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function waPhoneBrazil(celular) {
  let d = digitsOnly(celular);
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.length < 12 || d.length > 15) return null;
  return d;
}

function buildWhatsAppUrl(celular, text) {
  const n = waPhoneBrazil(celular);
  if (!n) return null;
  const t = String(text || "").slice(0, 1800);
  return `https://wa.me/${n}?text=${encodeURIComponent(t)}`;
}

function trunc(s, max) {
  const x = String(s || "").trim();
  if (x.length <= max) return x;
  return x.slice(0, max - 1) + "…";
}

function msgAberturaChamado({ clienteNome, numeroChamado, titulo, descricao }) {
  const nome = trunc(clienteNome, 80);
  const tit = trunc(titulo, 120);
  const des = trunc(descricao, 400);
  return (
    `Olá${nome ? `, *${nome}*` : ""}! Seu chamado foi aberto no *PGcallSystem*.\n\n` +
    `*Nº do chamado:* #${numeroChamado}\n` +
    `*Título:* ${tit}\n` +
    `*Descrição:* ${des || "(sem descrição)"}\n\n` +
    `_Em caso de dúvida, responda esta conversa._`
  );
}

function msgStatusChamado({ clienteNome, numeroChamado, titulo, descricao, statusLabel }) {
  const nome = trunc(clienteNome, 80);
  const tit = trunc(titulo, 120);
  const des = trunc(descricao, 350);
  return (
    `Olá${nome ? `, *${nome}*` : ""}! Atualização do seu chamado no *PGcallSystem*.\n\n` +
    `*Nº do chamado:* #${numeroChamado}\n` +
    `*Novo status:* ${statusLabel}\n` +
    `*Título:* ${tit}\n` +
    `*Descrição:* ${des || "(sem descrição)"}\n\n` +
    `_Esta é uma notificação automática._`
  );
}

module.exports = {
  buildWhatsAppUrl,
  msgAberturaChamado,
  msgStatusChamado,
  waPhoneBrazil
};
