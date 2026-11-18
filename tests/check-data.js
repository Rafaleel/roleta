// Autoverificação da lista: node tests/check-data.js
const assert = require("assert");
global.window = {};
require("../data.js");
const { temas } = window.DADOS;
const MIN = { produtos: 4, publicos: 6, reviravoltas: 6 };

assert(Array.isArray(temas) && temas.length > 0, "data.js precisa ter a lista de temas");
const vistos = new Map();
for (const t of temas) {
  assert(typeof t.nome === "string" && t.nome, "tema sem nome");
  for (const campo of Object.keys(MIN)) {
    const lista = t[campo];
    assert(Array.isArray(lista) && lista.length >= MIN[campo], `${t.nome}: ${campo} precisa de ${MIN[campo]} itens`);
    lista.forEach((x) => assert(typeof x === "string" && x.trim(), `${t.nome}: item vazio em ${campo}`));
    const dup = lista.filter((x, i) => lista.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== i);
    assert.deepStrictEqual(dup, [], `${t.nome}: repetidos em ${campo}: ${dup}`);
  }
  t.publicos.forEach((p) => assert(p.startsWith("para "), `${t.nome}: público deve começar com "para ": ${p}`));
  for (const p of t.produtos) {
    const k = p.toLowerCase();
    assert(!vistos.has(k), `produto em dois temas: "${p}" (${vistos.get(k)} e ${t.nome})`);
    vistos.set(k, t.nome);
  }
}
const unicos = (campo) => new Set(temas.flatMap((t) => t[campo].map((x) => x.toLowerCase()))).size;
const total = { produtos: vistos.size, publicos: unicos("publicos"), reviravoltas: unicos("reviravoltas") };
assert(total.produtos >= 150 && total.publicos >= 40 && total.reviravoltas >= 40, JSON.stringify(total));
console.log(`${temas.length} temas ok:`, total);
