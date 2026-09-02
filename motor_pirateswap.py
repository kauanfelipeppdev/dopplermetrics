import requests

def calcular_custo_real_pirateswap(preco_vitrine, saldo_residual=0.0):
    """
    Aplica a matemática financeira do Doppler Metrics para o PirateSwap.
    """
    valor_faltante = preco_vitrine - saldo_residual
    
    if valor_faltante <= 0:
        return 0.0
    
    # Bônus de 35% no Pix (Valor Necessário = Valor Faltante / 1.35)
    custo_com_bonus = valor_faltante / 1.35
    
    # Trava do depósito mínimo de R$ 5,00
    deposito_minimo = 5.00
    if custo_com_bonus < deposito_minimo:
        return deposito_minimo
        
    return round(custo_com_bonus, 2)

def buscar_skins_pirateswap():
    # 1. Colocamos a URL COMPLETA de volta, com os HashCodes
    url_api = "https://web.pirateswap.com/inventory/v2/ExchangerInventory?orderBy=price&sortOrder=DESC&page=1&results=40&searchPhrase=AK-47+%7C+Wintergreen&marketHashNameHashCodes=-40527640%2C1250950927%2C1158258090%2C1313419766%2C-892122372"
    
    # 2. Adicionamos mais Headers para "fingir" perfeitamente que somos o Google Chrome
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://pirateswap.com",
        "Referer": "https://pirateswap.com/"
    }
    
    print("Iniciando varredura no PirateSwap...\n")
    
    try:
        resposta = requests.get(url_api, headers=headers)
        
        if resposta.status_code == 200:
            dados = resposta.json()
            
            # LINHA DE DEBUG: Vamos imprimir a resposta crua para ver o que o servidor mandou!
            print("Resposta do Servidor:", dados) 
            print("-" * 40)
            
            itens = dados.get('items', [])
            
            if not itens:
                print("⚠️ O servidor respondeu com sucesso, mas a lista de itens veio vazia.")
            
            saldo_usuario = 2.02 
            
            for item in itens:
                nome = item.get('marketHashName')
                float_skin = item.get('float')
                preco_vitrine = item.get('storePrice')
                
                if float_skin is not None and preco_vitrine is not None:
                    custo_real = calcular_custo_real_pirateswap(preco_vitrine, saldo_usuario)
                    print(f"🔫 {nome} | Float: {float_skin:.4f} | Vitrine: R$ {preco_vitrine} | Real: R$ {custo_real}")
                    
        else:
            print(f"Erro na requisição. Código: {resposta.status_code}")
            
    except Exception as e:
        print(f"Erro ao processar a API: {e}")
    # A URL exata que você capturou na aba Network
    url_api = "https://web.pirateswap.com/inventory/v2/ExchangerInventory?orderBy=price&sortOrder=DESC&page=1&results=40&searchPhrase=AK-47+%7C+Wintergreen"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }
    
    print("Iniciando varredura no PirateSwap...\n")
    
    try:
        resposta = requests.get(url_api, headers=headers)
        
        if resposta.status_code == 200:
            dados = resposta.json()
            itens = dados.get('items', [])
            
            # Seu saldo residual fixo para o teste
            saldo_usuario = 2.02 
            
            for item in itens:
                nome = item.get('marketHashName')
                float_skin = item.get('float')
                preco_vitrine = item.get('storePrice')
                
                # Alguns itens (como caixas/adesivos) podem não ter float
                if float_skin is not None and preco_vitrine is not None:
                    custo_real = calcular_custo_real_pirateswap(preco_vitrine, saldo_usuario)
                    
                    print(f"🔫 Arma: {nome}")
                    print(f"📊 Float: {float_skin:.4f}")
                    print(f"💰 Preço Vitrine: R$ {preco_vitrine}")
                    print(f"✅ Custo Efetivo (Pix): R$ {custo_real}")
                    print("-" * 40)
                    
        else:
            print(f"Erro na requisição. Código: {resposta.status_code}")
            
    except Exception as e:
        print(f"Erro ao processar a API: {e}")

if __name__ == "__main__":
    buscar_skins_pirateswap()