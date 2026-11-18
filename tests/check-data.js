// Autoverificação da lista: node tests/check-data.js
const assert = require("assert");
global.window = {};
require("../data.js");
const { produtos, publicos, reviravoltas } = window.DADOS;
for (const [nome, lista, min] of [["produtos", produtos, 150], ["publicos", publicos, 40], ["reviravoltas", reviravoltas, 40]]) {
  assert(lista.length >= min, `${nome}: ${lista.length} < ${min}`);
  const dup = lista.filter((x, i) => lista.findIndex(y => y.toLowerCase() === x.toLowerCase()) !== i);
  assert.deepStrictEqual(dup, [], `${nome} duplicados: ${dup}`);
  console.log(nome, lista.length, "ok");
}
