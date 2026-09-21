# Aion 2 Guide

Overlay de guia de leveling 1–45 para Aion 2. Mostra uma part por vez, flutua
sobre o jogo sem sumir quando o foco vai para outra janela, e guarda o progresso.

Construído a partir do *Aion 2 Level 1–45 Ultimate Speedrun Guide*: 5 fases,
11 parts, 21 ações e 8 mapas anotados.

## O jogo precisa estar em borderless windowed

Esta é a limitação que mais gera dúvida, e não tem como contornar: em **tela
cheia exclusiva o Windows não deixa nenhum overlay aparecer**, nem este nem
qualquer outro. Nas opções gráficas do Aion 2, escolha *janela sem bordas* ou
*borderless windowed*.

## Usar

Baixe o instalador ou o portátil em `release/` e abra. A janela sobe no canto
superior direito.

| Atalho | O que faz |
|---|---|
| `Ctrl+Alt+→` | próxima part |
| `Ctrl+Alt+←` | part anterior |
| `Ctrl+Alt+Enter` | concluir a part atual |
| `Ctrl+Alt+M` | abrir e fechar o mapa |
| `Ctrl+Alt+H` | esconder e mostrar o overlay |
| `Ctrl+Alt+C` | ligar e desligar os cliques atravessando |

Os atalhos são globais: funcionam com o jogo em foco, que é o ponto. Se algum
não responder, outro programa já tomou a combinação — o app avisa no console ao
abrir, e dá para trocar em `src/core/hotkeys.ts` e recompilar.

Com "cliques atravessam" ligado, o overlay para de receber até o passar do
mouse, e `Ctrl+Alt+C` é a única forma de voltar.

Nos botões do cabeçalho: 🗺 abre o mapa da part (desabilitado nas três que não
têm), ☰ lista todas as parts para pular direto, `?` mostra a legenda das cores e
a lista de downtime, ⚙ tem opacidade, click-through e reset.

**O mapa abre ao lado, não por cima.** A janela cresce para caber os dois, com a
borda direita ancorada — o card não sai do lugar, é o espaço à esquerda que
aparece. A alça entre os dois decide quanto cada um ocupa, por arrasto ou pelas
setas do teclado, e a proporção fica salva. No painel do mapa há `−`, `⟲` e `+`
para o zoom, que também responde à roda do mouse; com zoom, arrastar move a
imagem.

**Navegar nunca marca nada.** Dá para percorrer o guia inteiro para frente e
para trás sem tocar no progresso; só o botão CONCLUIR e as caixinhas das ações
escrevem. É a regra central do app e tem teste para ela.

O progresso fica em `%APPDATA%\Aion 2 Guide\progress.json`.

Rodando pelo código, sem empacotar, o caminho é outro: `%APPDATA%\aion2guide\`.
O Electron usa o `name` do `package.json` quando o app não está empacotado, e o
`productName` quando está. Vale saber antes de procurar o arquivo no lugar
errado.

## Segunda tela

O núcleo é uma página web comum, e não sabe que o Electron existe. Para usar num
segundo monitor, num tablet ou no celular, sem overlay:

```bash
npm install
npm run extract        # gera os mapas, que não são versionados
npm run dev -- --host
```

Abra o endereço de rede que o Vite imprimir. O progresso nesse caso fica no
navegador, separado do progresso do app.

## Desenvolver

```bash
npm install
npm run extract      # uma vez, para gerar public/maps/
npm run dev          # servidor de desenvolvimento e a janela Electron
npm test             # a suíte: 201 testes
npm run build        # checa os tipos e empacota o núcleo web
npm run dist         # gera o instalador e o portátil em release/
```

`npm test` não checa tipos. Rode `npx tsc --noEmit` junto — foi ele que pegou
três assinaturas quebradas que a suíte deixava passar.

### Se o app abrir como se fosse Node, sem janela

Se `electron .` falhar com `does not provide an export named 'app'`, ou rodar
sem abrir janela nenhuma, procure a variável de ambiente `ELECTRON_RUN_AS_NODE`.
Com ela definida, o `electron.exe` roda como Node puro: sem APIs, sem janela, e
o erro parece bug de código quando não é. Alguns editores a definem para os
processos filhos.

```bash
unset ELECTRON_RUN_AS_NODE   # ou `Remove-Item Env:ELECTRON_RUN_AS_NODE` no PowerShell
```

### Como o conteúdo é montado

`data/guide.json` **é a fonte da verdade** e pode ser editado à mão — é lá que
entra, se alguém escrever, o texto de cada seta numerada dos mapas.

Ele foi gerado uma vez a partir do `.docx` por `npm run extract`, que também
recorta a borda preta dos mapas (20,8% dos pixels de todas as oito imagens) e
converte para WebP em `public/maps/`, levando 18 MB a 1,4 MB. **Rodar o extract
de novo sobrescreve edições manuais**; ele existe para reimportar se sair uma
versão nova do guia.

Como `public/maps/` não é versionado, depois de clonar o repositório rode
`npm run extract` uma vez.

### Estrutura

```
data/guide.json      conteúdo
scripts/             importador do .docx
src/core/            lógica: guia, progresso, persistência, hotkeys
src/ui/              card, mapa, painéis
electron/            janela, hotkeys globais, disco
```

As três camadas são independentes: `src/` não sabe que o Electron existe e
detecta a ponte em tempo de execução, e `electron/` não sabe nada sobre o guia.
É isso que faz a segunda tela sair de graça.

### Uma nota sobre o vidro

O `backdrop-filter` dos painéis não desfoca nada quando o app roda como janela
transparente: atrás da página está a área de trabalho, fora do alcance dele. Na
segunda tela, dentro de uma aba, ele volta a valer.

Por isso os painéis são **opacos** no CSS, e a translucidez vem inteira do
controle de opacidade nos ajustes, que age na janela. Uma alavanca só: com alfa
no CSS *e* opacidade de janela, as duas se multiplicam e o texto do que está
atrás fantasma por cima do guia.
