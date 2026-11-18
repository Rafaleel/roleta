(() => {
  "use strict";

  const { produtos, publicos, reviravoltas } = window.DADOS;
  const LISTAS = { produto: produtos, publico: publicos, reviravolta: reviravoltas };
  const N_FATIAS = Math.min(14, produtos.length); // entre 12 e 16 fatias por giro
  const PASSO = 360 / N_FATIAS;
  const CORES = [
    ["#7c3aed", "#fff"], ["#ff6b6b", "#1b1035"], ["#ffd23f", "#1b1035"], ["#2ec4b6", "#1b1035"],
    ["#f472b6", "#1b1035"], ["#3d5af1", "#fff"], ["#ff9f43", "#1b1035"]
  ];
  const MAX_PROMPTS = 5;
  const TEMPO_TOTAL = 40 * 60;
  const CHAVE_HIST = "roleta-absurda:historico";
  const CHAVE_NAOREP = "roleta-absurda:nao-repetir";
  const CHAVE_SESSAO = "roleta-absurda:ja-sorteados"; // sessionStorage: some ao fechar a aba

  const $ = (id) => document.getElementById(id);
  const menosMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];
  const embaralhar = (lista) => {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* ---------- Armazenamento (pode falhar em aba anônima) ---------- */
  function ler(chave, padrao, area = "localStorage") {
    try {
      const v = window[area].getItem(chave);
      return v === null ? padrao : JSON.parse(v);
    } catch (e) { return padrao; }
  }
  function gravar(chave, valor, area = "localStorage") {
    try { window[area].setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem armazenamento: segue só na memória */ }
  }

  /* ---------- Som (Web Audio, começa desligado) ---------- */
  let somLigado = false;
  let audio = null;
  function tom(freq, inicio, dur, tipo = "triangle", vol = 0.15) {
    if (!somLigado || !audio) return;
    try {
      const t = audio.currentTime + inicio;
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = tipo;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* falha de áudio nunca pode travar o giro */ }
  }
  const somTick = () => tom(1400, 0, 0.035, "square", 0.05);
  const somSlot = () => tom(700, 0, 0.03, "square", 0.03);
  const somTrava = () => { tom(520, 0, 0.12, "triangle", 0.12); tom(780, 0.06, 0.15, "triangle", 0.1); };
  const somVitoria = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tom(f, i * 0.09, 0.35, "triangle", 0.14));

  $("btnSom").addEventListener("click", () => {
    somLigado = !somLigado;
    if (somLigado) {
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        audio.resume();
      } catch (e) { somLigado = false; }
    }
    $("btnSom").setAttribute("aria-pressed", String(somLigado));
    $("btnSom").title = somLigado ? "Desligar som" : "Ligar som";
    $("txtSom").textContent = somLigado ? "Som ligado" : "Som desligado";
    if (somLigado) somTrava();
  });

  /* ---------- Roleta (SVG) ---------- */
  const NS = "http://www.w3.org/2000/svg";
  const rodaGiro = $("rodaGiro");
  const ponteiro = $("ponteiro");
  let rotacao = 0;            // graus, sentido horário
  let fatias = [];            // produtos mostrados na roleta agora
  let girando = false;

  const ponto = (r, ang) => {
    const rad = (ang * Math.PI) / 180;
    return [(r * Math.sin(rad)).toFixed(2), (-r * Math.cos(rad)).toFixed(2)];
  };

  // Quebra o nome em até 2 linhas curtas para caber na fatia.
  function linhas(txt, max = 19) {
    const out = [];
    let atual = "";
    for (const p of txt.split(" ")) {
      if (!atual || (atual + " " + p).length <= max) atual = atual ? atual + " " + p : p;
      else { out.push(atual); atual = p; }
    }
    out.push(atual);
    if (out.length > 2) out.splice(1, out.length, out.slice(1).join(" "));
    return out.map((l) => (l.length > max ? l.slice(0, max - 1).trimEnd() + "…" : l));
  }

  function desenharLampadas() {
    const g = $("lampadas");
    for (let i = 0; i < 28; i++) {
      const [x, y] = ponto(200, (i * 360) / 28);
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", "4");
      c.setAttribute("class", "lampada" + (i % 2 ? " alt" : ""));
      g.appendChild(c);
    }
  }

  function desenharRoda() {
    rodaGiro.textContent = "";
    fatias.forEach((nome, i) => {
      const [cor, corTxt] = CORES[i % CORES.length];
      const a0 = i * PASSO, a1 = (i + 1) * PASSO;
      const [x0, y0] = ponto(192, a0), [x1, y1] = ponto(192, a1);
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", `M0 0 L${x0} ${y0} A192 192 0 0 1 ${x1} ${y1} Z`);
      path.setAttribute("fill", cor);
      path.setAttribute("stroke", "#1b1035");
      path.setAttribute("stroke-width", "2");
      rodaGiro.appendChild(path);

      const txt = document.createElementNS(NS, "text");
      txt.setAttribute("class", "fatia-txt");
      txt.setAttribute("fill", corTxt);
      txt.setAttribute("text-anchor", "end");
      txt.setAttribute("transform", `rotate(${(a0 + PASSO / 2 - 90).toFixed(2)})`);
      const ls = linhas(nome);
      ls.forEach((l, k) => {
        const ts = document.createElementNS(NS, "tspan");
        ts.setAttribute("x", "180");
        ts.setAttribute("y", ls.length === 1 ? "4" : k === 0 ? "-2.5" : "10.5");
        ts.textContent = l;
        txt.appendChild(ts);
      });
      rodaGiro.appendChild(txt);
    });
    aplicarRotacao();
  }

  const aplicarRotacao = () => rodaGiro.setAttribute("transform", `rotate(${rotacao.toFixed(3)})`);
  // Índice da fatia que está embaixo do ponteiro (topo) para uma rotação.
  const fatiaNoPonteiro = (rot) => Math.floor((((-rot % 360) + 360) % 360) / PASSO) % N_FATIAS;

  // Monta as fatias do giro: o vencedor + outros produtos aleatórios.
  function montarFatias(vencedor) {
    const outros = embaralhar(produtos.filter((p) => p !== vencedor)).slice(0, N_FATIAS - 1);
    const lista = embaralhar([vencedor, ...outros]);
    return { lista, alvo: lista.indexOf(vencedor) };
  }

  function tremerPonteiro() {
    if (menosMovimento()) return;
    ponteiro.classList.remove("tic");
    void ponteiro.offsetWidth; // reinicia a animação
    ponteiro.classList.add("tic");
  }

  // Aceleração suave no começo e desaceleração longa no fim.
  const easing = (t) => {
    const saida = 1 - Math.pow(1 - t, 4);
    const r = Math.min(1, t / 0.12);
    return saida * (r * r * (3 - 2 * r));
  };

  function girarRoda(vencedor) {
    return new Promise((resolve) => {
      const { lista, alvo } = montarFatias(vencedor);
      rotacao = ((rotacao % 360) + 360) % 360;
      fatias = lista;
      desenharRoda();

      const folga = (Math.random() - 0.5) * PASSO * 0.6; // não para sempre no centro da fatia
      const destinoBase = (((-(alvo + 0.5) * PASSO + folga) % 360) + 360) % 360;
      const reduz = menosMovimento();
      const voltas = reduz ? 0 : 5 + Math.floor(Math.random() * 3);
      let delta = destinoBase - rotacao;
      if (delta <= 0) delta += 360;
      const inicio = rotacao;
      const total = delta + voltas * 360;
      const dur = reduz ? 500 : 4200 + Math.random() * 1600; // 4,2 s a 5,8 s
      let ultimaFatia = fatiaNoPonteiro(rotacao);
      const t0 = performance.now();
      document.body.classList.add("girando");

      const quadro = (agora) => {
        const t = Math.min(1, (agora - t0) / dur);
        rotacao = inicio + total * easing(t);
        aplicarRotacao();
        const f = fatiaNoPonteiro(rotacao);
        if (f !== ultimaFatia) { ultimaFatia = f; somTick(); tremerPonteiro(); }
        if (t < 1) requestAnimationFrame(quadro);
        else {
          document.body.classList.remove("girando");
          console.assert(fatias[fatiaNoPonteiro(rotacao)] === vencedor, "ponteiro fora do vencedor");
          resolve();
        }
      };
      requestAnimationFrame(quadro);
    });
  }

  /* ---------- Caça-níquel ---------- */
  function girarSlot(elTxt, lista, final) {
    return new Promise((resolve) => {
      const caixa = elTxt.parentElement;
      if (menosMovimento()) { elTxt.textContent = final; resolve(); return; }
      caixa.classList.add("ativo");
      const passos = 16 + Math.floor(Math.random() * 6);
      let i = 0;
      const prox = () => {
        i++;
        if (i >= passos) {
          elTxt.textContent = final;
          elTxt.classList.remove("rola");
          elTxt.classList.add("trava");
          caixa.classList.remove("ativo");
          somTrava();
          setTimeout(() => elTxt.classList.remove("trava"), 500);
          resolve();
          return;
        }
        elTxt.textContent = sortear(lista);
        elTxt.classList.remove("rola");
        void elTxt.offsetWidth;
        elTxt.classList.add("rola");
        somSlot();
        setTimeout(prox, 45 + Math.pow(i / passos, 3) * 260); // freia no final
      };
      prox();
    });
  }

  /* ---------- Confete (canvas próprio) ---------- */
  const canvas = $("confete");
  const ctx = canvas.getContext("2d");
  let pedacos = [];
  let confeteRodando = false;
  function confete() {
    if (menosMovimento()) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cores = ["#8b5cf6", "#ff6b6b", "#ffd23f", "#2ec4b6", "#f472b6", "#ffffff"];
    const qtd = innerWidth < 600 ? 120 : 220;
    for (let i = 0; i < qtd; i++) {
      const lado = i % 2 ? 1 : -1;
      pedacos.push({
        x: innerWidth / 2 + lado * innerWidth * 0.05, y: innerHeight * 0.55,
        vx: lado * (2 + Math.random() * 9) * (innerWidth / 900 + 0.4), vy: -(9 + Math.random() * 12),
        w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        cor: cores[i % cores.length], vida: 0
      });
    }
    if (!confeteRodando) { confeteRodando = true; requestAnimationFrame(animarConfete); }
  }
  function animarConfete() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    pedacos = pedacos.filter((p) => p.y < innerHeight + 40 && p.vida < 400);
    for (const p of pedacos) {
      p.vida++; p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.vida * 0.15));
      ctx.fillStyle = p.cor;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (pedacos.length) requestAnimationFrame(animarConfete);
    else { confeteRodando = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------- Avisos ---------- */
  let timerToast;
  function avisar(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("mostra");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => t.classList.remove("mostra"), 3200);
  }
  const anunciar = (msg) => { $("anuncio").textContent = msg; };

  /* ---------- Histórico ---------- */
  const valido = (h) => !!h && typeof h === "object" && typeof h.quando === "number" &&
    ["produto", "publico", "reviravolta"].every((k) => typeof h[k] === "string");
  let historico = ler(CHAVE_HIST, []);
  historico = Array.isArray(historico) ? historico.filter(valido) : [];
  let jaSorteados = ler(CHAVE_SESSAO, [], "sessionStorage");
  if (!Array.isArray(jaSorteados)) jaSorteados = [];
  const marcarSorteado = (p) => { jaSorteados.push(p); gravar(CHAVE_SESSAO, jaSorteados, "sessionStorage"); };
  const chkNaoRepetir = $("chkNaoRepetir");
  chkNaoRepetir.checked = ler(CHAVE_NAOREP, false) === true;
  chkNaoRepetir.addEventListener("change", () => gravar(CHAVE_NAOREP, chkNaoRepetir.checked));

  function renderHistorico() {
    const ol = $("listaHist");
    ol.textContent = "";
    historico.slice(0, 30).forEach((h) => {
      const li = document.createElement("li");
      const hora = document.createElement("span");
      hora.className = "hora";
      hora.textContent = new Date(h.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const prod = document.createElement("span");
      prod.className = "h-prod";
      prod.textContent = h.produto;
      if (h.aceito) {
        const ok = document.createElement("span");
        ok.className = "ok";
        ok.textContent = "✓ missão aceita";
        prod.appendChild(ok);
      }
      const det = document.createElement("span");
      det.className = "h-det";
      det.textContent = `${h.publico} · ${h.reviravolta}`;
      li.append(hora, prod, det);
      ol.appendChild(li);
    });
    $("histVazio").hidden = historico.length > 0;
    $("btnLimpar").disabled = historico.length === 0;
  }
  function salvarHistorico() {
    historico = historico.slice(0, 100);
    gravar(CHAVE_HIST, historico);
    renderHistorico();
  }
  $("btnLimpar").addEventListener("click", () => {
    historico = [];
    jaSorteados = [];
    gravar(CHAVE_SESSAO, jaSorteados, "sessionStorage");
    salvarHistorico();
    avisar("Histórico limpo.");
  });

  /* ---------- Sorteio ---------- */
  const estado = { produto: "", publico: "", reviravolta: "", trocas: {}, id: 0 };
  const btnGirar = $("btnGirar");
  const botoesTrocar = document.querySelectorAll(".btn-trocar");

  // Produtos que podem sair agora (respeita "não repetir" e evita o atual ao trocar).
  function poolProdutos(excluir) {
    let pool = produtos.filter((p) => p !== excluir);
    if (chkNaoRepetir.checked) {
      const usados = new Set(jaSorteados);
      const livres = pool.filter((p) => !usados.has(p));
      if (livres.length) pool = livres;
      else {
        jaSorteados = [];
        avisar("Todos os produtos já saíram! A lista recomeçou.");
      }
    }
    return pool;
  }

  function travar(sim) {
    girando = sim;
    btnGirar.disabled = sim;
    $("btnAceitar").disabled = sim;
    botoesTrocar.forEach((b) => { b.disabled = sim || !!estado.trocas[b.dataset.parte]; });
  }

  function mostrarProduto() {
    const el = $("valProduto");
    el.textContent = estado.produto;
    el.classList.remove("novo");
    void el.offsetWidth;
    el.classList.add("novo");
  }

  async function sortearTudo() {
    if (girando) return;
    estado.trocas = {};
    botoesTrocar.forEach((b) => { b.classList.remove("usado"); b.textContent = "Trocar"; });
    travar(true);
    anunciar("Girando a roleta...");
    estado.produto = sortear(poolProdutos());
    marcarSorteado(estado.produto);
    estado.publico = sortear(publicos);
    estado.reviravolta = sortear(reviravoltas);

    await girarRoda(estado.produto);
    confete();
    somVitoria();
    $("placeholder").hidden = true;
    $("resultado").hidden = false;
    // reinicia a animação de entrada do cartão
    $("resultado").style.animation = "none"; void $("resultado").offsetWidth; $("resultado").style.animation = "";
    mostrarProduto();
    $("valPublico").textContent = "…";
    $("valReviravolta").textContent = "…";
    if (window.innerWidth < 900 && !document.body.classList.contains("projetor")) {
      $("resultado").scrollIntoView({ behavior: menosMovimento() ? "auto" : "smooth", block: "start" });
    }
    await girarSlot($("valPublico"), publicos, estado.publico);
    await girarSlot($("valReviravolta"), reviravoltas, estado.reviravolta);

    estado.id = Date.now();
    historico.unshift({ id: estado.id, quando: estado.id, produto: estado.produto, publico: estado.publico, reviravolta: estado.reviravolta, aceito: false });
    salvarHistorico();
    travar(false);
    // o botão desativado perde o foco; devolve para quem usa teclado
    if (document.activeElement === document.body) btnGirar.focus({ preventScroll: true });
    anunciar(`Sorteado:${estado.produto}, ${estado.publico}, que ${estado.reviravolta}.`);
  }

  async function trocar(parte) {
    if (girando || estado.trocas[parte]) return;
    estado.trocas[parte] = true;
    const btn = document.querySelector(`.btn-trocar[data-parte="${parte}"]`);
    btn.classList.add("usado");
    btn.textContent = "Trocado";
    travar(true);
    if (parte === "produto") {
      estado.produto = sortear(poolProdutos(estado.produto));
      marcarSorteado(estado.produto);
      await girarRoda(estado.produto);
      confete();
      somVitoria();
      mostrarProduto();
    } else {
      const lista = LISTAS[parte];
      const atual = estado[parte];
      estado[parte] = sortear(lista.filter((x) => x !== atual));
      await girarSlot($(parte === "publico" ? "valPublico" : "valReviravolta"), lista, estado[parte]);
    }
    const h = historico.find((x) => x.id === estado.id);
    if (h) { h[parte] = estado[parte]; salvarHistorico(); }
    travar(false);
    if (document.activeElement === document.body || document.activeElement.disabled) $("btnAceitar").focus({ preventScroll: true });
    anunciar(`Nova parte sorteada:${estado[parte]}.`);
  }

  btnGirar.addEventListener("click", sortearTudo);
  botoesTrocar.forEach((b) => b.addEventListener("click", () => trocar(b.dataset.parte)));

  /* ---------- Missão ---------- */
  let prompts = 0;
  let missaoAceita = 0; // id do sorteio da missão aberta: voltar e aceitar de novo não zera o contador
  function mostrarTela(missao) {
    $("telaRoleta").hidden = missao;
    $("telaMissao").hidden = !missao;
    window.scrollTo({ top: 0, behavior: "auto" });
    if (missao) $("tituloMissao").focus(); else btnGirar.focus();
  }

  $("btnAceitar").addEventListener("click", () => {
    if (girando) return;
    if (document.body.classList.contains("projetor")) alternarProjetor();
    $("mProduto").textContent = estado.produto;
    $("mPublico").textContent = estado.publico;
    $("mReviravolta").textContent = estado.reviravolta;
    if (missaoAceita !== estado.id) {
      missaoAceita = estado.id;
      $("listaIdeias").textContent = "";
      $("btnIdeias").textContent = "💡 Gerar ideias de prompt";
      prompts = 0;
      atualizarPrompts();
    }
    const h = historico.find((x) => x.id === estado.id);
    if (h) { h.aceito = true; salvarHistorico(); }
    mostrarTela(true);
    confete();
    somVitoria();
  });
  $("btnVoltar").addEventListener("click", () => mostrarTela(false));

  function atualizarPrompts() {
    $("numPrompts").textContent = `${prompts} / ${MAX_PROMPTS}`;
    $("btnMenos").disabled = prompts <= 0;
    $("btnMais").disabled = prompts >= MAX_PROMPTS;
    document.querySelectorAll("#bolinhas i").forEach((b, i) => b.classList.toggle("on", i < prompts));
    const aviso = $("avisoPrompts");
    const resta = MAX_PROMPTS - prompts;
    aviso.textContent = resta === 0 ? "Acabaram os prompts! Agora é com você." : resta === 1 ? "Só falta 1 prompt. Capriche!" : `Restam ${resta} prompts.`;
    aviso.classList.toggle("alerta", resta <= 1);
  }
  $("btnMais").addEventListener("click", () => { prompts = Math.min(MAX_PROMPTS, prompts + 1); atualizarPrompts(); somSlot(); });
  $("btnMenos").addEventListener("click", () => { prompts = Math.max(0, prompts - 1); atualizarPrompts(); somSlot(); });

  /* Cronômetro */
  let restante = TEMPO_TOTAL;
  let intervalo = null;
  let fimEm = 0;
  function mostrarTempo() {
    const m = Math.floor(restante / 60), s = restante % 60;
    $("relogio").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    $("barraTempo").style.transform = `scaleX(${restante / TEMPO_TOTAL})`;
    $("relogio").classList.toggle("fim", restante === 0);
  }
  function pausar() {
    clearInterval(intervalo);
    intervalo = null;
    $("btnTempo").textContent = restante === 0 ? "Iniciar" : "Continuar";
  }
  $("btnTempo").addEventListener("click", () => {
    if (intervalo) { pausar(); return; }
    if (restante === 0) restante = TEMPO_TOTAL;
    fimEm = Date.now() + restante * 1000; // baseado no relógio: não atrasa com a aba em segundo plano
    intervalo = setInterval(() => {
      restante = Math.max(0, Math.round((fimEm - Date.now()) / 1000));
      mostrarTempo();
      if (restante === 0) { pausar(); somVitoria(); avisar("⏰ Tempo esgotado!"); }
    }, 250);
    $("btnTempo").textContent = "Pausar";
  });
  $("btnZerar").addEventListener("click", () => {
    pausar();
    restante = TEMPO_TOTAL;
    $("btnTempo").textContent = "Iniciar";
    mostrarTempo();
  });

  /* Copiar missão */
  function textoMissao() {
    return [
      "🎰 ROLETA DO PRODUTO ABSURDO · Minha missão",
      "",
      `Produto: ${estado.produto}`,
      `Público-alvo: ${estado.publico}`,
      `Reviravolta: ${estado.reviravolta}`,
      "",
      "Crie no Canva uma apresentação de 6 slides vendendo seu produto:",
      "1. Capa: nome do produto + logo",
      "2. O problema que ele resolve",
      "3. Como funciona",
      "4. Para quem é (o público sorteado)",
      "5. A reviravolta e como o produto lida com ela",
      "6. Preço, slogan e um anúncio final",
      "",
      "Regras da IA:",
      "- Você DEVE usar a IA do Canva para gerar pelo menos as imagens.",
      "- Você pode usar no MÁXIMO 5 prompts de IA no total. Escolha bem.",
      "- Nome do produto, slogan e preço precisam ser criados por VOCÊ, sem IA.",
      "- Mude pelo menos 3 coisas no que a IA gerar (cor, texto, posição, fonte...)."
    ].join("\n");
  }
  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (e) {
      const ativo = document.activeElement;
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      if (ativo) ativo.focus();
      return ok;
    }
  }
  $("btnCopiar").addEventListener("click", async () => {
    const ok = await copiar(textoMissao());
    avisar(ok ? "✅ Missão copiada! Cole onde quiser." : "Não consegui copiar. Selecione o texto e copie manualmente.");
  });

  /* Ideias de prompt */
  const ESTILOS = ["fotografia de estúdio realista", "ilustração 3D estilo animação", "pôster retrô dos anos 80", "aquarela suave", "arte em pixel estilo videogame antigo", "colagem de papel recortado", "desenho de quadrinhos com contorno grosso", "foto publicitária de revista"];
  const PALETAS = ["tons pastel de rosa e azul-bebê", "roxo e amarelo vibrantes", "verde-água e coral", "laranja, vermelho e creme", "azul-marinho com detalhes dourados", "cores neon sobre fundo escuro", "preto e branco com um único detalhe vermelho"];
  const ENQUADRAMENTOS = ["close-up centralizado", "plano aberto mostrando o ambiente", "vista de cima (plano zenital)", "ângulo de baixo para cima, deixando o produto heroico", "plano médio com o produto em primeiro plano", "vista em três quartos (diagonal)"];
  const LUZES = ["luz suave de janela", "luz dramática de palco", "luz de pôr do sol", "iluminação de estúdio com fundo liso", "brilho mágico ao redor"];
  const CENARIOS = ["numa sala de aula", "numa cozinha aconchegante", "no pampa gaúcho ao entardecer", "numa vitrine de loja", "no espaço sideral", "num quarto bagunçado", "numa praça da cidade"];

  function gerarIdeias() {
    const prod = estado.produto.charAt(0).toLowerCase() + estado.produto.slice(1);
    const quem = estado.publico.replace(/^para\s+/i, "");
    const [e1, e2, e3] = embaralhar(ESTILOS);
    const [p1, p2, p3] = embaralhar(PALETAS);
    const [q1, q2, q3] = embaralhar(ENQUADRAMENTOS);
    return [
      { tipo: "Imagem do produto (capa)", txt: `${e1} de ${prod}, ${q1}, ${sortear(LUZES)}, paleta em ${p1}, fundo simples, sem texto na imagem.` },
      { tipo: "Cena de uso (público)", txt: `${e2} mostrando ${quem} usando ${prod} ${sortear(CENARIOS)}, expressões alegres, ${q2}, cores em ${p2}.` },
      { tipo: "Cena da reviravolta", txt: `${e3} de ${prod} numa situação em que o produto ${estado.reviravolta}, clima divertido e exagerado, ${q3}, ${sortear(LUZES)}, paleta em ${p3}.` }
    ].map((i) => ({ ...i, txt: i.txt.charAt(0).toUpperCase() + i.txt.slice(1) }));
  }
  $("btnIdeias").addEventListener("click", () => {
    const box = $("listaIdeias");
    box.textContent = "";
    gerarIdeias().forEach((i) => {
      const d = document.createElement("div");
      d.className = "ideia";
      const h = document.createElement("h3");
      h.textContent = i.tipo;
      const p = document.createElement("p");
      p.textContent = `“${i.txt}”`;
      d.append(h, p);
      box.appendChild(d);
    });
    const nota = document.createElement("p");
    nota.className = "nota-ideias";
    nota.textContent = "São só inspirações: mude o estilo, as cores e o enquadramento do seu jeito. Clique de novo para outras ideias.";
    box.appendChild(nota);
    $("btnIdeias").textContent = "💡 Outras ideias de prompt";
  });

  /* ---------- Modo projetor ---------- */
  function alternarProjetor() {
    const ligar = !document.body.classList.contains("projetor");
    document.body.classList.toggle("projetor", ligar);
    $("btnProjetor").setAttribute("aria-pressed", String(ligar));
    $("txtProjetor").textContent = ligar ? "Sair do projetor" : "Modo projetor";
    try {
      if (ligar && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (!ligar && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) { /* sem tela cheia (ex.: iPhone): o modo funciona só com o layout grande */ }
    if (ligar) { mostrarTela(false); window.scrollTo(0, 0); }
  }
  $("btnProjetor").addEventListener("click", alternarProjetor);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && document.body.classList.contains("projetor")) alternarProjetor();
  });
  // sem tela cheia (recusada ou indisponível), Esc também sai do modo projetor
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.fullscreenElement && document.body.classList.contains("projetor")) alternarProjetor();
  });

  /* ---------- Início ---------- */
  desenharLampadas();
  fatias = montarFatias(sortear(produtos)).lista;
  desenharRoda();
  renderHistorico();
  atualizarPrompts();
  mostrarTempo();

  // Ganchos para testes automatizados.
  window.__roleta = { fatiaNoPonteiro: () => fatias[fatiaNoPonteiro(rotacao)], estado };
})();
