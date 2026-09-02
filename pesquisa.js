// Array global para guardar os itens salvos no carrinho
// Array global para guardar os itens salvos no carrinho
let carrinho = JSON.parse(localStorage.getItem("doppler_carrinho")) || [];

// ==========================================================================
// Regras reais de cada loja (mínimos de depósito por método de pagamento e
// bônus do cupom). Fonte única de verdade — tanto os cards de resultado
// quanto o otimizador de compras usam esses valores.
// Só as lojas que o sistema realmente integra (PirateSwap, DashSkins e
// DashSkins.gg) estão aqui.
// ==========================================================================
const STORE_CONFIG = {
  PirateSwap: {
    bonusPct: 0.35,
    pix: { minimo: 5.0, aceita: true },
    cartao: { minimo: 25.9, aceita: true },
  },
  DashSkins: {
    bonusPct: 0.02,
    pix: { minimo: 10.0, aceita: true },
    cartao: { minimo: 10.0, aceita: true },
  },
  "DashSkins.gg": {
    bonusPct: 0.0,
    pix: { minimo: 10.0, aceita: true },
    cartao: { minimo: null, aceita: false },
  },
};

function arredonda2(valor) {
  return Math.round(valor * 100) / 100;
}

// ==========================================================================
// Gaveta de filtros no mobile (a sidebar de filtros vira um painel deslizante
// em telas estreitas, em vez de empilhar acima dos resultados).
// ==========================================================================
function abrirFiltrosMobile() {
  document.getElementById("filtros-sidebar")?.classList.add("is-open");
  document.getElementById("sidebar-backdrop")?.classList.add("is-open");
}

function fecharFiltrosMobile() {
  document.getElementById("filtros-sidebar")?.classList.remove("is-open");
  document.getElementById("sidebar-backdrop")?.classList.remove("is-open");
}

function limparFiltros() {
  ["preco-min", "preco-max", "float-min", "float-max"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  atualizarIndicadorFiltros();
}

// Mostra um pontinho verde no botão "Filters" (mobile) quando algum filtro
// de preço/float está ativo, pra ficar claro que a busca está sendo filtrada.
function atualizarIndicadorFiltros() {
  const ids = ["preco-min", "preco-max", "float-min", "float-max"];
  const algumAtivo = ids.some((id) => {
    const el = document.getElementById(id);
    return el && el.value !== "";
  });
  const dot = document.getElementById("filter-active-dot");
  if (dot) dot.style.display = algumAtivo ? "inline-block" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  ["preco-min", "preco-max", "float-min", "float-max"].forEach((id) => {
    document
      .getElementById(id)
      ?.addEventListener("input", atualizarIndicadorFiltros);
  });
});

// Calcula quanto você realmente precisa depositar por um método de
// pagamento específico, respeitando o mínimo daquela loja/método e o
// bônus do cupom. Retorna também o crédito que sobra (saldo residual
// gerado) quando o mínimo obriga a depositar mais do que o necessário.
function calcularDeposito(valorFaltante, bonusPct, minimo) {
  let deposito = valorFaltante / (1 + bonusPct);
  let ajustadoPeloMinimo = false;

  if (deposito < minimo) {
    deposito = minimo;
    ajustadoPeloMinimo = true;
  }

  const creditoRecebido = deposito * (1 + bonusPct);
  const saldoExcedente = Math.max(0, creditoRecebido - valorFaltante);

  return {
    deposito: arredonda2(deposito),
    creditoRecebido: arredonda2(creditoRecebido),
    saldoExcedente: arredonda2(saldoExcedente),
    ajustadoPeloMinimo,
  };
}

// Para uma loja, dado o custo total dos itens e o saldo residual já
// disponível ali, decide o método de pagamento mais barato (Pix vs Cartão,
// quando ambos existem) e retorna o plano de depósito ótimo.
function calcularDepositoOtimoLoja(loja, custoItens, saldoResidual) {
  const config = STORE_CONFIG[loja];
  if (!config) return null;

  const valorFaltante = Math.max(0, custoItens - saldoResidual);

  if (valorFaltante === 0) {
    return {
      loja,
      metodo: null,
      deposito: 0,
      saldoExcedente: 0,
      ajustadoPeloMinimo: false,
      valorFaltante: 0,
    };
  }

  const opcoes = [];

  if (config.pix.aceita) {
    opcoes.push({
      metodo: "Pix",
      ...calcularDeposito(valorFaltante, config.bonusPct, config.pix.minimo),
    });
  }
  if (config.cartao.aceita) {
    opcoes.push({
      metodo: "Card",
      ...calcularDeposito(valorFaltante, config.bonusPct, config.cartao.minimo),
    });
  }

  // Escolhe o método que exige o menor desembolso real
  opcoes.sort((a, b) => a.deposito - b.deposito);
  const melhor = opcoes[0];

  return { loja, valorFaltante, ...melhor };
}

// Fallback link to the item's page on its official store, usado quando a
// API não trouxe um "inspectInGameLink" real (steam://). URLs confirmadas:
// - PirateSwap: pirateswap.com/store/{slug-sem-exterior} (páginas por skin)
// - DashSkins: dashskins.com.br/en/item/{slug}/{_id} (página por listagem)
// - DashSkins.gg: dashskins.gg/item/{slug}/{id} (página por listagem)
// Se faltar algum dado (ex.: item_id), cai no fallback seguro pra home da loja.

function removerExterior(nome) {
  return (nome || "")
    .replace(
      /\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i,
      "",
    )
    .trim();
}

function slugificarNome(nome) {
  return (nome || "")
    .toLowerCase()
    .replace(/★/g, "")
    .replace(/™/g, "")
    .replace(/\|/g, "")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function gerarLinkLoja(skin) {
  const { loja, nome, item_id } = skin;

  switch (loja) {
    case "PirateSwap": {
      const slug = slugificarNome(removerExterior(nome));
      return slug
        ? `https://pirateswap.com/store/${slug}`
        : "https://pirateswap.com/store";
    }
    case "DashSkins": {
      const slug = slugificarNome(nome);
      return item_id
        ? `https://dashskins.com.br/en/item/${slug}/${item_id}`
        : "https://dashskins.com.br/en";
    }
    case "DashSkins.gg": {
      const slug = slugificarNome(nome);
      return item_id
        ? `https://dashskins.gg/item/${slug}/${item_id}`
        : "https://dashskins.gg/";
    }
    default:
      return "#";
  }
}

// ==========================================================================
// Estado da última busca, usado pelo botão "Load More" pra re-executar a
// mesma busca pedindo mais resultados às lojas, sem o usuário precisar
// preencher tudo de novo.
// ==========================================================================
const LIMITE_INICIAL = 40;
const LIMITE_INCREMENTO = 40;
let estadoBusca = null;

// Guarda os itens já encontrados na busca atual (todas as lojas, já
// filtrados por preço/float) e a ordenação escolhida, pra poder reordenar
// instantaneamente sem precisar buscar tudo de novo nas lojas.
let skinsEncontradas = [];
let ordemAtual = "custo_asc";

function ordenarSkins(lista, ordem) {
  const copia = [...lista];
  switch (ordem) {
    case "custo_desc":
      return copia.sort((a, b) => b.custo_real - a.custo_real);
    case "float_asc":
      return copia.sort((a, b) => a.float - b.float);
    case "float_desc":
      return copia.sort((a, b) => b.float - a.float);
    case "custo_asc":
    default:
      return copia.sort((a, b) => a.custo_real - b.custo_real);
  }
}

// Chamado quando o usuário troca o select "Sort by" — não busca nada de
// novo nas lojas, só reordena o que já está em tela.
function mudarOrdenacao() {
  const select = document.getElementById("ordenar-por");
  ordemAtual = select ? select.value : "custo_asc";

  const cardsGrid = document.querySelector(".cards-grid");
  if (!cardsGrid || skinsEncontradas.length === 0) return;

  const ordenadas = ordenarSkins(skinsEncontradas, ordemAtual);
  cardsGrid.innerHTML = ordenadas.map(construirCardHTML).join("");
}

async function simularCalculo() {
  const saldoPirateSwap =
    document.getElementById("saldo-pirateswap").value || 0;
  const saldoDashSkins = document.getElementById("saldo-dashskins").value || 0;
  const saldoDashSkinsGG =
    document.getElementById("saldo-dashskinsgg").value || 0;

  const skinNome = document.getElementById("skin-nome").value;

  const precoMinInput = document.getElementById("preco-min").value;
  const precoMaxInput = document.getElementById("preco-max").value;
  const floatMinInput = document.getElementById("float-min").value;
  const floatMaxInput = document.getElementById("float-max").value;

  const precoMin = precoMinInput !== "" ? parseFloat(precoMinInput) : 0;
  const precoMax = precoMaxInput !== "" ? parseFloat(precoMaxInput) : Infinity;
  const floatMin = floatMinInput !== "" ? parseFloat(floatMinInput) : 0;
  const floatMax = floatMaxInput !== "" ? parseFloat(floatMaxInput) : 1.0;

  if (!skinNome) {
    alert("Please enter a skin name to search the radar.");
    return;
  }

  // Fecha a gaveta de filtros no mobile assim que a busca é disparada
  fecharFiltrosMobile();

  // Guarda os parâmetros dessa busca pra poder repeti-la com "Load More"
  estadoBusca = {
    skinNome,
    precoMin,
    precoMax,
    floatMin,
    floatMax,
    saldoPirateSwap,
    saldoDashSkins,
    saldoDashSkinsGG,
    limite: LIMITE_INICIAL,
  };

  await executarBusca();
}

function carregarMaisSkins() {
  if (!estadoBusca) return;
  estadoBusca.limite += LIMITE_INCREMENTO;
  executarBusca();
}

// Monta o HTML de um único card de skin. Extraído pra função própria pra
// poder ser chamado tanto na renderização progressiva (por loja) quanto
// depois de qualquer refiltragem, sem duplicar a lógica.
function construirCardHTML(skin) {
  const config = STORE_CONFIG[skin.loja] || {
    bonusPct: 0,
    pix: { minimo: 0 },
  };
  const depositoMinimo = config.pix.minimo;
  const bonusPct = `${Math.round(config.bonusPct * 100)}%`;
  let classeBadge = "badge-pirate";
  let tipoLoja = "Marketplace";

  if (skin.loja === "DashSkins") {
    classeBadge = "badge-dash-normal";
    tipoLoja = "Marketplace";
  } else if (skin.loja === "DashSkins.gg") {
    classeBadge = "badge-dash-gg";
    tipoLoja = "P2P Trade";
  }

  const atingiuMinimo =
    skin.custo_real === depositoMinimo && skin.preco_vitrine < depositoMinimo;
  const classeAlerta = atingiuMinimo ? "danger" : "safe";

  let textoAlerta = `✓ Calculated via Pix (${bonusPct} Bonus)`;
  if (atingiuMinimo) {
    textoAlerta = `⚠️ Warning: Funds locked (Min. Deposit R$ ${depositoMinimo.toFixed(2).replace(".", ",")})`;
  } else if (skin.loja === "DashSkins.gg") {
    textoAlerta = "✓ Real P2P Price (No bonus)";
  }

  const imagemHTML = skin.imagem
    ? `<img src="${skin.imagem}" alt="${skin.nome}" loading="lazy" style="max-height: 130px; width: auto; object-fit: contain;">`
    : `🔫 ${skin.nome.split("(")[0]}`;

  let seloClassificacao = "";
  let classeSelo = "";

  if (skin.loja === "PirateSwap") {
    seloClassificacao = "🔥 Excellent Opportunity (35% Bonus)";
    classeSelo = "badge-excelente";
  } else if (skin.custo_real < skin.preco_vitrine) {
    seloClassificacao = "👍 Good Price / Below Average";
    classeSelo = "badge-bom";
  } else {
    seloClassificacao = "⚖️ Fair Market Price";
    classeSelo = "badge-justo";
  }

  const linkInspecionar = skin.link_inspecionar;
  const linkLoja = gerarLinkLoja(skin);
  const temLinkInspecionar = !!linkInspecionar;

  const botaoInspecionarHTML = temLinkInspecionar
    ? `<a href="${linkInspecionar}" class="btn-view-store btn-inspect">🔎 Inspect in Game</a>`
    : `<span class="btn-view-store btn-inspect btn-disabled" title="No in-game inspect link available for this listing">🔎 Inspect in Game</span>`;

  const botaoLojaHTML = `<a href="${linkLoja}" target="_blank" rel="noopener noreferrer" class="btn-view-store">View on ${skin.loja} ↗</a>`;

  const stattrakHTML = skin.is_stattrak
    ? `<span class="stattrak-tag">StatTrak™</span>`
    : "";

  const stickersHTML =
    skin.stickers && skin.stickers.length > 0
      ? `<div class="sticker-row">${skin.stickers
          .map(
            (s) =>
              `<img src="${s.imagem}" alt="${s.nome}" title="${s.nome}" class="sticker-icon">`,
          )
          .join("")}</div>`
      : "";

  const floatPct = (skin.float * 100).toFixed(2);
  const floatBarHTML = `
      <div class="float-bar-wrapper">
          <span class="float-tag-adjusted">Float: ${skin.float}</span>
          <div class="float-bar-bg">
              <div class="float-marker" style="left: ${floatPct}%;"></div>
          </div>
      </div>
  `;

  return `
              <div class="skin-card">
                  <div class="store-badge-row">
                      <div class="store-badge ${classeBadge}">${skin.loja}</div>
                      <span class="store-type-tag">${tipoLoja}</span>
                      ${stattrakHTML}
                  </div>
                  <div class="skin-image-placeholder" style="background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; height: 150px; border-radius: 8px; margin-bottom: 15px; margin-top: 10px;">
                      ${imagemHTML}
                  </div>
                  <div class="skin-info">
                      <!-- Barra de Float entra aqui -->
                      ${floatBarHTML}
                      ${stickersHTML}
                      
                      <div class="price-container" style="margin-bottom: 8px;">
                          <span class="old-price">Storefront: R$ ${skin.preco_vitrine.toFixed(2).replace(".", ",")}</span>
                          <span class="real-price">Real Cost: <span class="green-text">R$ ${skin.custo_real.toFixed(2).replace(".", ",")}</span></span>
                      </div>
                      <span class="${classeSelo}">${seloClassificacao}</span>
                  </div>
                  <button onclick="adicionarAoCarrinho('${skin.loja}', '${skin.nome.replace(/'/g, "")}', ${skin.preco_vitrine}, ${skin.custo_real}, ${skin.float}, '${skin.imagem}')" style="width: 100%; background-color: transparent; border: 1px solid var(--green-gamma); color: var(--green-gamma); padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 10px; margin-bottom: 10px; transition: 0.2s;">+ Add to Cart</button>
                  <div class="store-actions-row">
                      ${botaoInspecionarHTML}
                      ${botaoLojaHTML}
                  </div>
                  <div class="card-footer">
                      <span class="alert-tag ${classeAlerta}">${textoAlerta}</span>
                  </div>
              </div>
          `;
}

// Placeholder que imita o formato de um card real, exibido instantaneamente
// enquanto as lojas ainda estão respondendo (loading por card, não em tela cheia).
function construirSkeletonHTML() {
  return `
    <div class="skeleton-card">
        <div class="skeleton-line skeleton-badge"></div>
        <div class="skeleton-line skeleton-image"></div>
        <div class="skeleton-line skeleton-bar"></div>
        <div class="skeleton-line skeleton-text"></div>
        <div class="skeleton-line skeleton-text short"></div>
        <div class="skeleton-line skeleton-button"></div>
    </div>
  `;
}

function renderizarSkeletons(cardsGrid, quantidade) {
  cardsGrid.innerHTML = construirSkeletonHTML().repeat(quantidade);
}

async function executarBusca() {
  const {
    skinNome,
    precoMin,
    precoMax,
    floatMin,
    floatMax,
    saldoPirateSwap,
    saldoDashSkins,
    saldoDashSkinsGG,
    limite,
  } = estadoBusca;

  const cardsGrid = document.querySelector(".cards-grid");
  const btnCarregarMais = document.getElementById("btn-carregar-mais");
  const isNovaBusca = limite === LIMITE_INICIAL;

  if (btnCarregarMais) {
    btnCarregarMais.disabled = true;
    btnCarregarMais.textContent = "Loading...";
  }

  // Loading por card: mostra skeletons no lugar do overlay em tela cheia.
  // Numa nova busca, começa do zero; num "Load More" mantém os cards
  // existentes e só acrescenta skeletons no final enquanto busca mais.
  if (isNovaBusca) {
    renderizarSkeletons(cardsGrid, 8);
  } else {
    cardsGrid.insertAdjacentHTML(
      "beforeend",
      construirSkeletonHTML().repeat(4),
    );
  }

  let todasSkins = [];
  let algumaLojaTemMais = false;
  let houveErroDeConexao = false;

  // Aplica filtro de preço/float + ordenação escolhida pelo usuário e
  // redesenha a grid. Chamada a cada loja que responde, pra ir preenchendo
  // a tela progressivamente em vez de esperar as três ao mesmo tempo.
  function rerenderizar() {
    const filtradas = todasSkins.filter((skin) => {
      const atendePreco =
        skin.custo_real >= precoMin && skin.custo_real <= precoMax;
      const atendeFloat = skin.float >= floatMin && skin.float <= floatMax;
      return atendePreco && atendeFloat;
    });
    const ordenadas = ordenarSkins(filtradas, ordemAtual);

    // Guarda o resultado filtrado (sem ordenar) pra reordenar depois sem
    // precisar buscar tudo de novo nas lojas.
    skinsEncontradas = filtradas;

    if (ordenadas.length === 0) {
      cardsGrid.innerHTML =
        "<p style='color: var(--gray-text); grid-column: 1 / -1;'>No skins found within the radar parameters provided.</p>";
      return;
    }

    cardsGrid.innerHTML = ordenadas.map(construirCardHTML).join("");
  }

  // Caminho relativo: como o api.py serve o próprio frontend, isso
  // funciona igual em localhost (uvicorn na 8000) e em produção, sem
  // precisar trocar URL nenhuma no deploy.
  function buscarLoja(endpoint, saldo) {
    return fetch(
      `/api/skins/${endpoint}?arma=${encodeURIComponent(skinNome)}&saldo=${saldo}&limite=${limite}`,
    )
      .then((resp) => resp.json())
      .then((dados) => {
        if (dados.status === "sucesso") {
          todasSkins = todasSkins.concat(dados.dados);
          if (dados.dados.length >= limite) algumaLojaTemMais = true;
        }
        rerenderizar();
      })
      .catch((err) => {
        houveErroDeConexao = true;
        console.error(`Erro ao buscar ${endpoint}:`, err);
      });
  }

  await Promise.all([
    buscarLoja("pirateswap", saldoPirateSwap),
    buscarLoja("dashskins", saldoDashSkins),
    buscarLoja("dashskinsgg", saldoDashSkinsGG),
  ]);

  if (todasSkins.length === 0 && cardsGrid.querySelector(".skeleton-card")) {
    // Nenhuma loja retornou nada (ou todas falharam) — limpa os skeletons.
    cardsGrid.innerHTML =
      "<p style='color: var(--gray-text); grid-column: 1 / -1;'>No skins found within the radar parameters provided.</p>";
  }

  if (houveErroDeConexao && todasSkins.length === 0) {
    alert(
      "Could not connect to the Python server. Check if Uvicorn is running on port 8000.",
    );
  }

  if (btnCarregarMais) {
    btnCarregarMais.style.display = algumaLojaTemMais ? "block" : "none";
    btnCarregarMais.disabled = false;
    btnCarregarMais.textContent = "Load More";
  }
}

// Funções do Carrinho e Otimizador
// Executa assim que a página carrega para restaurar o carrinho e os saldos salvos
document.addEventListener("DOMContentLoaded", () => {
  atualizarCarrinhoUI();

  // Restaura os saldos residuais se existirem no localStorage
  const saldoPirateSalvo = localStorage.getItem("doppler_saldo_pirateswap");
  const saldoDashSalvo = localStorage.getItem("doppler_saldo_dashskins");
  const saldoDashGGSalvo = localStorage.getItem("doppler_saldo_dashskinsgg");

  if (saldoPirateSalvo !== null) {
    document.getElementById("saldo-pirateswap").value = saldoPirateSalvo;
  }
  if (saldoDashSalvo !== null) {
    document.getElementById("saldo-dashskins").value = saldoDashSalvo;
  }
  if (saldoDashGGSalvo !== null) {
    document.getElementById("saldo-dashskinsgg").value = saldoDashGGSalvo;
  }
});

// Salva os saldos no LocalStorage sempre que o usuário alterar os campos
document.getElementById("saldo-pirateswap")?.addEventListener("input", (e) => {
  localStorage.setItem("doppler_saldo_pirateswap", e.target.value);
});

document.getElementById("saldo-dashskins")?.addEventListener("input", (e) => {
  localStorage.setItem("doppler_saldo_dashskins", e.target.value);
});

document.getElementById("saldo-dashskinsgg")?.addEventListener("input", (e) => {
  localStorage.setItem("doppler_saldo_dashskinsgg", e.target.value);
});

function fmtBRL(valor) {
  return valor.toFixed(2).replace(".", ",");
}

function abrirModalOtimizacao() {
  document.getElementById("modal-otimizacao").classList.add("is-open");
}

function fecharModalOtimizacao() {
  document.getElementById("modal-otimizacao").classList.remove("is-open");
}

function fecharModalOtimizacaoSeClicouFora(event) {
  if (event.target.id === "modal-otimizacao") {
    fecharModalOtimizacao();
  }
}

function otimizarCompras() {
  const resultadoDiv = document.getElementById("otimizacao-resultado");

  if (carrinho.length === 0) {
    resultadoDiv.innerHTML = `<p class="opt-empty">Your cart is empty! Add some skins first.</p>`;
    abrirModalOtimizacao();
    return;
  }

  const saldosPorLoja = {
    PirateSwap:
      parseFloat(document.getElementById("saldo-pirateswap").value) || 0,
    DashSkins:
      parseFloat(document.getElementById("saldo-dashskins").value) || 0,
    "DashSkins.gg":
      parseFloat(document.getElementById("saldo-dashskinsgg").value) || 0,
  };

  // Agrupa os itens do carrinho por loja usando o preço de VITRINE (não o
  // custo real calculado item a item). Isso importa: o depósito mínimo se
  // aplica ao valor TOTAL depositado de uma vez, então comprar vários itens
  // juntos numa mesma loja aproveita melhor esse mínimo do que calcular
  // cada item isoladamente.
  let resumoPorLoja = {};

  carrinho.forEach((item) => {
    if (!resumoPorLoja[item.loja]) {
      resumoPorLoja[item.loja] = { itens: [], totalVitrine: 0 };
    }
    resumoPorLoja[item.loja].itens.push(item.nome);
    resumoPorLoja[item.loja].totalVitrine += item.precoVitrine;
  });

  let totalDepositos = 0;
  let totalSaldoUsado = 0;
  let totalSaldoExcedenteGerado = 0;
  let cardsHTML = "";

  for (let loja in resumoPorLoja) {
    const dados = resumoPorLoja[loja];
    const saldoDisponivel = saldosPorLoja[loja] || 0;
    const plano = calcularDepositoOtimoLoja(
      loja,
      dados.totalVitrine,
      saldoDisponivel,
    );

    if (!plano) continue; // loja não integrada ao sistema, ignora

    const saldoUsado = Math.min(saldoDisponivel, dados.totalVitrine);
    totalSaldoUsado += saldoUsado;
    totalDepositos += plano.deposito;
    totalSaldoExcedenteGerado += plano.saldoExcedente || 0;

    let notasHTML = "";
    if (plano.deposito > 0) {
      if (plano.ajustadoPeloMinimo) {
        notasHTML += `<div class="opt-note">⚠️ Adjusted up to this store's minimum ${plano.metodo} deposit</div>`;
      }
      if (plano.saldoExcedente > 0) {
        notasHTML += `<div class="opt-note opt-note-good">💡 Leftover credit for your next purchase here: R$ ${fmtBRL(plano.saldoExcedente)}</div>`;
      }
    } else {
      notasHTML += `<div class="opt-note opt-note-good">✓ Fully paid with residual balance!</div>`;
    }

    cardsHTML += `
      <div class="opt-store-card">
          <div class="opt-store-title">🛒 ${loja}</div>
          <div class="opt-row"><span>Items in batch</span><span>${dados.itens.length}</span></div>
          <div class="opt-row"><span>Storefront cost</span><span>R$ ${fmtBRL(dados.totalVitrine)}</span></div>
          <div class="opt-row"><span>Balance used</span><span>R$ ${fmtBRL(saldoUsado)}</span></div>
          ${
            plano.deposito > 0
              ? `<div class="opt-row"><span>Payment method</span><span>${plano.metodo}</span></div>`
              : ""
          }
          <div class="opt-highlight">
              <span class="opt-highlight-label">Recommended deposit</span>
              <span class="opt-highlight-value">R$ ${fmtBRL(plano.deposito)}</span>
          </div>
          ${notasHTML}
      </div>
    `;
  }

  const summaryHTML = `
    <div class="opt-summary">
        <div class="opt-highlight">
            <span class="opt-highlight-label">💰 Total deposits needed</span>
            <span class="opt-highlight-value">R$ ${fmtBRL(totalDepositos)}</span>
        </div>
        <div class="opt-highlight">
            <span class="opt-highlight-label">💳 Total balance used</span>
            <span class="opt-highlight-value" style="color: var(--text);">R$ ${fmtBRL(totalSaldoUsado)}</span>
        </div>
        ${
          totalSaldoExcedenteGerado > 0
            ? `<div class="opt-highlight">
                <span class="opt-highlight-label">💡 Leftover credit generated</span>
                <span class="opt-highlight-value">R$ ${fmtBRL(totalSaldoExcedenteGerado)}</span>
              </div>`
            : ""
        }
    </div>
  `;

  resultadoDiv.innerHTML = cardsHTML + summaryHTML;
  abrirModalOtimizacao();
}

function adicionarAoCarrinho(
  loja,
  nome,
  precoVitrine,
  custoReal,
  float,
  imagem,
) {
  carrinho.push({ loja, nome, precoVitrine, custoReal, float, imagem });
  salvarECorrigirCarrinho();
}

function removerDoCarrinho(index) {
  carrinho.splice(index, 1);
  salvarECorrigirCarrinho();
}

function salvarECorrigirCarrinho() {
  localStorage.setItem("doppler_carrinho", JSON.stringify(carrinho));
  atualizarCarrinhoUI();
}

function atualizarCarrinhoUI() {
  const containerItens = document.getElementById("carrinho-itens");
  const textoVazio = document.getElementById("carrinho-vazio");
  const totalDiv = document.getElementById("carrinho-total");

  if (!containerItens) return;

  containerItens.innerHTML = "";

  if (carrinho.length === 0) {
    textoVazio.style.display = "block";
    totalDiv.innerText = "Total Real Cost: R$ 0.00";
    return;
  }

  textoVazio.style.display = "none";
  let custoTotalGlobal = 0;

  carrinho.forEach((item, index) => {
    custoTotalGlobal += item.custoReal;

    const itemDiv = document.createElement("div");
    itemDiv.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;";

    itemDiv.innerHTML = `
        <div>
            <strong style="color: var(--green-gamma);">${item.loja}</strong>: ${item.nome.split("(")[0]}<br>
            <span style="color: var(--gray-text);">R$ ${item.custoReal.toFixed(2).replace(".", ",")}</span>
        </div>
        <button onclick="removerDoCarrinho(${index})" style="background: none; border: none; color: var(--danger-red); cursor: pointer; font-weight: bold;">✕</button>
    `;
    containerItens.appendChild(itemDiv);
  });

  totalDiv.innerText = `Total Real Cost: R$ ${custoTotalGlobal.toFixed(2).replace(".", ",")}`;
}
