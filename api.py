from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles  # <--- ADICIONE ESTA LINHA AQUI
import requests
import os
import time
from urllib.parse import quote_plus, quote

app = FastAPI(title="Doppler Metrics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory="media"), name="media")

CACHE_TTL_SEGUNDOS = 300  # 5 minutos
_cache_lojas = {}

def cache_get(chave):
    entrada = _cache_lojas.get(chave)
    if not entrada:
        return None
    timestamp, dados = entrada
    if time.time() - timestamp > CACHE_TTL_SEGUNDOS:
        del _cache_lojas[chave]
        return None
    return dados

def cache_set(chave, dados):
    _cache_lojas[chave] = (time.time(), dados)

# --- 1. PIRATESWAP ---
def calcular_custo_real_pirateswap(preco_vitrine_api, saldo_residual=0.0):
    # Converte o preço base (USD) para BRL usando a taxa oficial do PirateSwap (5.176)
    preco_vitrine_brl = preco_vitrine_api * 5.176

    valor_faltante = preco_vitrine_brl - saldo_residual
    if valor_faltante <= 0: 
        return 0.0
    
    # Bônus de 35% no Pix
    custo_com_bonus = valor_faltante / 1.35
    
    # Trava do depósito mínimo de R$ 5,00
    deposito_minimo = 5.00
    if custo_com_bonus < deposito_minimo: 
        return deposito_minimo
        
    return round(custo_com_bonus, 2)

@app.get("/api/skins/pirateswap")
def get_pirateswap_skins(arma: str, saldo: float = 0.0, limite: int = 40):
    termo_busca = quote_plus(arma)
    chave_cache = f"pirateswap:{arma.strip().lower()}:{limite}"

    itens = cache_get(chave_cache)

    if itens is None:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://pirateswap.com",
            "Referer": "https://pirateswap.com/"
        }

        try:
            url_auto = f"https://web.pirateswap.com/inventory/search/v2/autocomplete?searchPhrase={termo_busca}"
            resp_auto = requests.get(url_auto, headers=headers)

            hash_codes = []
            if resp_auto.status_code == 200:
                dados_auto = resp_auto.json()
                for item in dados_auto:
                    codes = item.get("marketNameHashCodes", [])
                    hash_codes.extend(codes)

            if not hash_codes:
                cache_set(chave_cache, [])
                return {"status": "sucesso", "dados": []}

            hash_str = "%2C".join(map(str, set(hash_codes)))
            url_api = f"https://web.pirateswap.com/inventory/v2/ExchangerInventory?orderBy=price&sortOrder=DESC&page=1&results={limite}&searchPhrase={termo_busca}&marketHashNameHashCodes={hash_str}"

            resposta = requests.get(url_api, headers=headers)
            if resposta.status_code != 200:
                return {"erro": "Falha ao acessar o PirateSwap"}

            itens = resposta.json().get('items', [])
            cache_set(chave_cache, itens)
        except Exception as e:
            return {"erro": str(e)}

    resultados = []

    for item in itens:
        nome = item.get('marketHashName')
        float_skin = item.get('float')
        preco_vitrine = item.get('storePrice')

        if float_skin is not None and preco_vitrine is not None:
            icon_hash = item.get('icon', '')
            imagem_url = f"https://community.cloudflare.steamstatic.com/economy/image/{icon_hash}/360fx360f" if icon_hash else ""
            custo_real = calcular_custo_real_pirateswap(preco_vitrine, saldo)

            # Link real "steam://" pra abrir o item direto no jogo (Inspect in game)
            link_inspecionar = item.get('inspectInGameLink')

            # Stickers/charms aplicados no item
            stickers_raw = item.get('stickers') or []
            stickers = [
                {
                    "nome": s.get('name'),
                    "imagem": s.get('imageUrl'),
                    "slot": s.get('slot')
                }
                for s in stickers_raw
            ]

            # StatTrak: usa a flag da API, com fallback pelo nome do item
            is_stattrak = bool(item.get('isStatTrak')) or 'stattrak' in (nome or '').lower()

            resultados.append({
                "loja": "PirateSwap",
                "nome": nome,
                "float": round(float_skin, 4),
                "preco_vitrine": preco_vitrine,
                "custo_real": custo_real,
                "imagem": imagem_url,
                "exterior": item.get('exterior'),
                "rarity": item.get('rarity'),
                "is_stattrak": is_stattrak,
                "is_souvenir": item.get('isSouvenir', False),
                "link_inspecionar": link_inspecionar,
                "stickers": stickers
            })

    return {"status": "sucesso", "dados": resultados}


# --- 2. DASHSKINS (NORMAL) ---
def calcular_custo_real_dashskins(preco_vitrine, saldo_residual=0.0):
    valor_faltante = preco_vitrine - saldo_residual
    if valor_faltante <= 0: return 0.0
    custo_com_bonus = valor_faltante / 1.02
    deposito_minimo = 10.00
    if custo_com_bonus < deposito_minimo: return deposito_minimo
    return round(custo_com_bonus, 2)

@app.get("/api/skins/dashskins")
def get_dashskins_skins(arma: str, saldo: float = 0.0, limite: int = 36):
    termo_busca = quote_plus(arma)
    chave_cache = f"dashskins:{arma.strip().lower()}:{limite}"

    resultados_raw = cache_get(chave_cache)

    if resultados_raw is None:
        url_api = f"https://dashskins.com.br/api/listing?search={termo_busca}&limit={limite}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://dashskins.com.br",
            "Referer": "https://dashskins.com.br/"
        }

        try:
            resposta = requests.get(url_api, headers=headers)
            if resposta.status_code != 200:
                return {"erro": "Falha ao acessar DashSkins"}

            resultados_raw = resposta.json().get('results', [])
            cache_set(chave_cache, resultados_raw)
        except Exception as e:
            return {"erro": str(e)}

    resultados = []

    for item in resultados_raw:
        nome = item.get('market_hash_name')
        preco_vitrine = item.get('price')
        wear_data = item.get('wear_data', {})
        float_skin = wear_data.get('floatvalue')

        if float_skin is not None and preco_vitrine is not None:
            imagem_url = item.get('image') or f"https://community.cloudflare.steamstatic.com/economy/image/{item.get('icon_url', '')}/360fx360f"
            custo_real = calcular_custo_real_dashskins(preco_vitrine, saldo)

            # Link real "steam://" pra abrir o item direto no jogo (Inspect in game)
            link_inspecionar = item.get('inspectLink')

            # Stickers aplicados no item
            stickers_raw = item.get('stickers') or []
            stickers = [
                {
                    "nome": s.get('name'),
                    "imagem": s.get('image'),
                    "slot": None
                }
                for s in stickers_raw
            ]

            # StatTrak: essa API não manda uma flag própria, então detecta pelo nome
            is_stattrak = 'stattrak' in (nome or '').lower()

            resultados.append({
                "loja": "DashSkins",
                "nome": nome,
                "float": round(float_skin, 4),
                "preco_vitrine": preco_vitrine,
                "custo_real": custo_real,
                "imagem": imagem_url,
                "exterior": item.get('exterior'),
                "rarity": item.get('rarity'),
                "is_stattrak": is_stattrak,
                "link_inspecionar": link_inspecionar,
                "stickers": stickers,
                "item_id": item.get('_id')
            })

    return {"status": "sucesso", "dados": resultados}


# --- 3. DASHSKINS.GG (P2P) ---
def calcular_custo_real_dashskins_gg(preco_vitrine, saldo_residual=0.0):
    valor_faltante = preco_vitrine - saldo_residual
    if valor_faltante <= 0: return 0.0
    custo_com_bonus = valor_faltante
    deposito_minimo = 10.00
    if custo_com_bonus < deposito_minimo: return deposito_minimo
    return round(custo_com_bonus, 2)

@app.get("/api/skins/dashskinsgg")
def get_dashskinsgg_skins(arma: str, saldo: float = 0.0, limite: int = 40):
    termo_busca = quote_plus(arma)
    chave_cache = f"dashskinsgg:{arma.strip().lower()}:{limite}"

    itens = cache_get(chave_cache)

    if itens is None:
        url_api = f"https://api.dashskins.gg/v1/item?pageSize={limite}&partialMarketHashName={termo_busca}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Origin": "https://dashskins.gg",
            "Referer": "https://dashskins.gg/"
        }

        try:
            resposta = requests.get(url_api, headers=headers)
            if resposta.status_code != 200:
                return {"erro": "Falha ao acessar DashSkins.gg"}

            dados = resposta.json()
            itens = dados.get('page', [])
            cache_set(chave_cache, itens)
        except Exception as e:
            return {"erro": str(e)}

    resultados = []

    for item in itens:
        nome = item.get('marketHashName')
        preco_vitrine = item.get('priceBRL')

        float_skin = item.get('float')
        skin_info = item.get('skinInfo', {})
        imagem_url = skin_info.get('image') or item.get('image', '')

        if float_skin is not None and preco_vitrine is not None:
            custo_real = calcular_custo_real_dashskins_gg(preco_vitrine, saldo)

            # Este endpoint não retorna um link de inspeção direto (P2P via trade),
            # só os stickers aplicados no item.
            stickers_raw = item.get('stickers') or []
            stickers = [
                {
                    "nome": s.get('marketHashName'),
                    "imagem": s.get('image'),
                    "slot": s.get('slot')
                }
                for s in stickers_raw
            ]

            # StatTrak: detecta pelo nome do item
            is_stattrak = 'stattrak' in (nome or '').lower()

            resultados.append({
                "loja": "DashSkins.gg",
                "nome": nome,
                "float": round(float_skin, 4),
                "preco_vitrine": preco_vitrine,
                "custo_real": custo_real,
                "imagem": imagem_url,
                "exterior": item.get('exterior'),
                "rarity": item.get('rarity'),
                "is_stattrak": is_stattrak,
                "link_inspecionar": item.get('inspectInGameLink'),
                "stickers": stickers,
                "item_id": item.get('id')
            })

    return {"status": "sucesso", "dados": resultados}


# --- ROTAS ESTÁTICAS E DE ASSETS ---
@app.get("/")
def read_index():
    return FileResponse("index.html")

@app.get("/pesquisa.html")
def read_pesquisa():
    return FileResponse("pesquisa.html")

@app.get("/style.css")
def read_style():
    return FileResponse("style.css")

@app.get("/pesquisa.css")
def read_pesquisa_css():
    return FileResponse("pesquisa.css")

@app.get("/pesquisa.js")
def read_pesquisa_js():
    return FileResponse("pesquisa.js")

@app.get("/sua-logo-aqui.png")
def read_logo():
    if os.path.exists("sua-logo-aqui.png"):
        return FileResponse("sua-logo-aqui.png")
    return {"erro": "Logo não encontrada"}