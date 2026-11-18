# 🎰 Roleta do Produto Absurdo

Site da aula do projeto **UNIPAMPA Cidadã · Módulo III · Inteligência Artificial**.

Cada aluno gira a roleta e sorteia três coisas:

1. um **produto absurdo**, que sai na roleta grande;
2. um **público-alvo**, que sai na máquina caça-níquel;
3. uma **reviravolta**, que também sai na caça-níquel.

O aluno pode trocar cada parte **uma única vez** e depois aceitar a missão. A tela **"Sua missão"** mostra as regras e traz algumas ferramentas:

- o roteiro dos 6 slides que ele vai criar no Canva com a IA do Canva;
- as regras de uso da IA;
- um contador de prompts usados, de 0 a 5;
- um cronômetro de 40 minutos;
- um botão para copiar a missão;
- um botão que gera ideias de prompt.

Outros recursos:

- **Modo projetor:** tela cheia com letras grandes, para sortear na frente da turma.
- **Histórico:** mostra os últimos sorteios. Ele fica salvo só neste navegador.
- **Não repetir produtos:** quando ligado, a roleta não sorteia de novo um produto que já saiu nesta aba do navegador. A lista recomeça quando você fecha a aba ou clica em "Limpar histórico".
- **Som:** começa desligado. Ligue no botão do topo. Todos os sons são gerados pelo próprio navegador, sem arquivos de áudio.

## Arquivos

| Arquivo | O que tem |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual (cores, fontes, animações) |
| `script.js` | Roleta, caça-níquel, confete, missão, histórico |
| `data.js` | **Lista de produtos, públicos e reviravoltas** |
| `favicon.svg` | Ícone da aba |
| `tests/check-data.js` | Confere se a lista está válida |

O site não precisa de instalação nem de compilação: são só HTML, CSS e JavaScript.

## Como editar a lista de itens

Abra o `data.js` em qualquer editor de texto. Você também pode editar direto no GitHub: abra o arquivo e clique no lápis ✏️.

A lista é dividida em **temas** (Escola, Comida, Animais, Espaço...). Cada tema tem três listas: `produtos`, `publicos` e `reviravoltas`. A roleta sorteia um produto de qualquer tema; o público-alvo e a reviravolta saem **só do mesmo tema**, para a combinação fazer sentido. O "Trocar" do produto troca por outro produto do mesmo tema.

```js
{
  nome: "Banho e cuidados",
  produtos: ["Patinho de borracha detetive", "Meu produto novo aqui", ...],
  publicos: ["para crianças que odeiam tomar banho", ...],
  reviravoltas: ["precisa funcionar debaixo d'água", ...]
},
```

Cuidados:

- Coloque o produto novo no tema em que ele combina.
- Mantenha as **aspas** e a **vírgula** no fim de cada linha.
- Cada tema precisa de pelo menos 4 produtos, 6 públicos e 6 reviravoltas.
- Um produto não pode estar em dois temas.
- Comece cada **público** com "para ..." e escreva cada **reviravolta** completando "O produto ..." (ex.: `"só funciona em dias de chuva"`).

Depois de salvar no GitHub, o site se atualiza sozinho em 1 ou 2 minutos.

Para conferir a lista (opcional, precisa do Node.js):

```sh
node tests/check-data.js
```

## Rodar no computador

Abra o `index.html` no navegador. Para que o botão "Copiar" funcione em todos os navegadores, prefira usar um servidor local:

```sh
python3 -m http.server 8000
# e abra http://localhost:8000
```
