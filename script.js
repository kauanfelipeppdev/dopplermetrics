document.addEventListener("DOMContentLoaded", () => {
  const elementoSaudacao = document.getElementById("saudacao-usuario");
  const modalNome = document.getElementById("modal-nome");

  let nomeUsuario = localStorage.getItem("doppler_nome_usuario");

  if (!nomeUsuario || nomeUsuario.trim() === "") {
    // Exibe o modal estilizado se não houver nome salvo
    if (modalNome) {
      modalNome.style.display = "flex";
    }
  } else {
    // Exibe a saudação direto se já estiver salvo
    if (elementoSaudacao) {
      elementoSaudacao.innerText = `Olá, ${nomeUsuario}. Bom ver você de volta.`;
    }
  }
});

function salvarNomeUsuario() {
  const input = document.getElementById("input-nome-usuario");
  const modalNome = document.getElementById("modal-nome");
  const elementoSaudacao = document.getElementById("saudacao-usuario");

  let nome = input ? input.value.trim() : "";

  if (!nome) {
    nome = "Trader"; // Nome padrão caso o usuário não digite nada
  }

  // Salva no localStorage
  localStorage.setItem("doppler_nome_usuario", nome);

  // Esconde o modal e atualiza a saudação na tela
  if (modalNome) {
    modalNome.style.display = "none";
  }

  if (elementoSaudacao) {
    elementoSaudacao.innerText = `Olá, ${nome}. Bom ver você de volta.`;
  }
}
