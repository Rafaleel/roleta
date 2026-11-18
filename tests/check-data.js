// Autoverificação da lista: node tests/check-data.js
const assert = require("assert");
global.window = {};
require("../data.js");
const { produtos } = window.DADOS;
assert(Array.isArray(produtos), "data.js precisa ter a lista produtos");
produtos.forEach((p) => assert(typeof p === "string" && p.trim(), "produto vazio"));
const dup = produtos.filter((x, i) => produtos.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== i);
assert.deepStrictEqual(dup, [], `produtos repetidos: ${dup}`);
assert(produtos.length >= 14, `só ${produtos.length} produtos (mínimo 14, para encher a roleta)`);
console.log(`produtos: ${produtos.length} ok`);
