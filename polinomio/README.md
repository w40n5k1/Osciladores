<!-- By Bruno Mota - METAbio -->
# Polinômio de 2º grau no plano complexo

Página interativa sobre as raízes de *y* = *x*² + *bx* + *c*, com *b* e *c* reais e *x* complexo: a superfície
|*y*| sobre o plano complexo de *x*, ao lado do gráfico de *y* para *x* real. Feita para o curso de Mecânica e
Termodinâmica do IMPA Tech, no mesmo modelo da página [Osciladores](../README.md), que está na raiz deste
repositório.

Para usar, abra `polinomio/index.html` no navegador, com o repositório inteiro ao lado dele: as fórmulas usam o
KaTeX de `vendor/katex/`, na raiz. Não há nada a instalar e a página funciona sem internet.

## O que a página mostra

- **Coeficientes** (à esquerda): as barras de *b* e de *c*, com segmentos coloridos e marcas (ver abaixo). Sob
  elas, o polinômio com os valores atuais, o discriminante, as raízes e o vértice.
- **Módulo |*y*| sobre o plano complexo de *x*** (painel principal): a superfície cuja altura sobre cada ponto
  *x* do plano (Re *x*, Im *x*) é |*y*|, mostrada até |*y*| = 8. Ela só se anula nas raízes, e é aí que toca o
  plano: os círculos cheios *x*<sub>+</sub> e *x*<sub>−</sub>. O círculo vazio é o ponto de sela, sobre *x* = −*b*/2. A curva azul é o
  corte da superfície sobre o eixo real, isto é, |*y*| para *x* real; a laranja, que se pode desligar, é o corte
  sobre a reta Re *x* = −*b*/2. Arrastar gira a superfície (com o foco nela, também as setas do teclado);
  «vista inicial» volta ao ponto de vista do começo.
- ***y* para *x* real** (painel lateral): a parábola *y* = *x*² + *bx* + *c*, com as raízes reais marcadas sobre
  o eixo e o vértice. Entre duas raízes reais, onde *y* < 0, a curva tracejada é |*y*|: a curva azul da
  superfície. Com raízes complexas a parábola não toca o eixo, e a nota sob o gráfico dá o seu menor valor.

A superfície é desenhada em projeção paralela, com a escala vertical comprimida: 8 unidades de |*y*| têm o
comprimento de 2,2 unidades do plano. Onde é vista por baixo, a superfície aparece quase transparente, para que
o seu interior se veja através da parede da frente. Uma raiz, ou o ponto de sela, que esteja atrás de uma parte
opaca aparece esmaecida.

## Modelo

    y = x² + b x + c = (x − x_v)² + y_v        x_v = −b/2        y_v = c − b²/4 = −Δ/4        Δ = b² − 4c

em que (*x*_v, *y*_v) é o vértice da parábola. As raízes são *x*<sub>±</sub> = (−*b* ± √Δ)/2 = *x*_v ± √(−*y*_v):

| discriminante | raízes |
|---|---|
| Δ > 0 | reais e distintas, *x*_v ± √Δ/2 |
| Δ = 0 | reais e iguais, *x*_v |
| Δ < 0 | complexas conjugadas, *x*_v ± i√(−Δ)/2 |

Com *x* = *u* + i*v* e *s* = *u* − *x*_v, Re *y* = *s*² − *v*² + *y*_v e Im *y* = 2*sv*. Assim, *y* é real sobre
duas retas do plano, que se cruzam em *x*_v: o eixo real, onde *y* = *y*_v + *s*², e a reta Re *x* = *x*_v, onde
*y* = *y*_v − *v*². As raízes estão na primeira se *y*_v ≤ 0 e na segunda se *y*_v ≥ 0.

Salvo se *y*_v = 0, a superfície |*y*| tem em *x*_v um ponto de sela, de altura |*y*_v|: um mínimo ao longo de
uma das duas retas e um máximo ao longo da outra. O gradiente de |*y*| não se anula em nenhum outro ponto (só
onde d*y*/d*x* = 2*x* + *b* = 0), de modo que os únicos mínimos de |*y*| são os seus zeros, as raízes. Como
|*y*| = |*x* − *x*<sub>+</sub>| |*x* − *x*<sub>−</sub>|, perto de uma raiz simples a superfície é um cone de inclinação
|*x*<sub>+</sub> − *x*<sub>−</sub>|, e numa raiz dupla ela é tangente ao plano.

Este é o polinômio característico da oscilação livre amortecida, *r*² + 2γ*r* + ω₀² = 0 (seção 3 das deduções de
Osciladores), com *b* = 2γ e *c* = ω₀²: raízes complexas no caso subamortecido, raiz dupla no crítico e raízes
reais no superamortecido.

## O que as barras indicam

| barra | segmentos e marcas |
|---|---|
| *b* | azul: raízes reais; laranja: raízes complexas, para \|*b*\| < 2√*c* (só se *c* > 0); marcas em 0 e em Δ = 0, isto é, em *b* = ±2√*c* |
| *c* | azul: raízes reais; laranja: raízes complexas, para *c* > *b*²/4; marcas em 0 e em Δ = 0, isto é, em *c* = *b*²/4 |

As marcas prendem o cursor da barra, para que o valor exato possa ser escolhido: em Δ = 0, a raiz dupla. Clicar
no rótulo de uma marca também o escolhe. Quando duas marcas ficam perto demais uma da outra, uma delas perde o
rótulo.

## Arquivos

    index.html                a página
    css/estilo.css            estilo: o de Osciladores, sem o que esta página não usa
    js/polinomio.js           o modelo: discriminante, vértice, raízes, y e |y| num ponto do plano
    js/formulas.js            polinômio, raízes e vértice em LaTeX; formatação dos números
    js/controles.js           barra deslizante com segmentos e marcas: cópia de ../js/controles.js
    js/graficos.js            os dois gráficos (canvas): a superfície, em projeção paralela, e y para x real
    js/app.js                 controles, estado e desenho: o ponto de partida para mudar a página
    tests/teste_polinomio.js  testes do modelo

O KaTeX não é repetido aqui: a página usa o de `../vendor/katex/`.

Faixas, passos e valores iniciais das barras estão em `GROUPS`; os intervalos mostrados pelos gráficos, em
`BOX`; e o ponto de vista inicial, em `VIEW`: todos no início de `js/app.js`. A caixa `BOX` foi escolhida para
conter todas as raízes que as barras podem produzir: quem alargar as faixas das barras precisa alargá-la também.

## Testes

    node polinomio/tests/teste_polinomio.js

a partir da raiz do repositório. Precisa apenas do node. Os testes verificam, sobre uma grade de *b* e *c* que
cobre as faixas das barras, que: as raízes anulam *y*, somam −*b* e têm produto *c*, e o seu tipo segue o sinal
de Δ; |*y*| = |*x* − *x*<sub>+</sub>| |*x* − *x*<sub>−</sub>| em qualquer ponto do plano; *y* tem os valores acima sobre as duas retas
em que é real; a superfície tem o ponto de sela descrito; nos valores críticos a raiz é dupla e o vértice fica
exatamente sobre o eixo; não aparece o sinal de um zero negativo; e raízes de tamanhos muito diferentes são
calculadas sem perda de algarismos.

Os testes cobrem o modelo. A página em si (gráficos, controles) não tem testes automáticos.

## Licença

MIT (ver `../LICENSE`). Bruno Mota, metaBIO, Instituto de Física, UFRJ.
