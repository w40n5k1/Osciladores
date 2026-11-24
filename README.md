<!-- By Bruno Mota - METAbio -->
# Osciladores: harmônicos, anarmônicos e quase-harmônicos

Página interativa sobre o oscilador em uma dimensão (harmônico ou com termos anarmônicos, livre ou forçado, com
amortecimento) e sobre o pêndulo. Feita para o curso de Mecânica e Termodinâmica do IMPA Tech.

Para usar, abra `index.html` no navegador, com a pasta inteira ao lado dele. Não há nada a instalar e a página
funciona sem internet.

## O que a página mostra

- **Controles** (à esquerda). No alto, a chave entre os dois sistemas: *Oscilador harmônico* (*M*, *k*, *b*, os
  termos anarmônicos λ₃ e λ₄, e a força externa) e *Pêndulo* (*M*, *L*, *g*, *b* e a força externa). Depois, as
  condições iniciais (*x*₀ e *p*₀, ou θ₀ e *p*_θ₀ no pêndulo) e a duração. As barras trazem segmentos coloridos e marcas (ver abaixo), com a
  legenda sob cada grupo.
- **Espaço de fase** (painel principal): a trajetória no plano *p* × *x*, sobre as curvas de energia constante do
  sistema sem atrito nem força externa. Os pontos de equilíbrio aparecem como círculos cheios (estáveis) ou
  vazios (instáveis); pelos instáveis passa a separatriz, tracejada. No oscilador linear forçado e amortecido, a
  elipse tracejada é o regime estacionário. No ponto atual há quatro setas: a velocidade (horizontal) e a força
  resultante (vertical), finas e cinza; a sua soma, que é o vetor tangente (*x'*, *p'*); e, mais grossa e
  vermelha, a força externa *F*₀ cos(ω*t*). Todas multiplicadas pelo mesmo tempo τ = 0,35/ω₀, de modo que
  mostram o deslocamento no diagrama durante τ, e a seta vermelha é a parte da seta vertical que se deve à
  força externa. Perto da ressonância ela é pequena: no regime estacionário em ω = ω₀, *F*₀ = *kA*/*Q*. Arrastar
  no diagrama escolhe a condição inicial.
- **Intervalos do diagrama**: as duas barras finas, embaixo e à esquerda, definem os intervalos de *x* e de *p*,
  sempre simétricos (de −*a* a *a*). Com «ajustar à curva» marcado, os intervalos acompanham a trajetória; mover
  uma das barras desmarca a opção. As barras das condições iniciais cobrem o intervalo do diagrama.
- **Energia** (painel lateral): energia cinética, potencial e total em função do tempo. No canto superior
  direito, o potencial *V*(*x*) no intervalo de *x* do diagrama, com a posição atual, o nível da energia total e
  a energia cinética (o segmento vertical entre os dois).
- **Tempo**: botão de reproduzir e pausar, e a barra do instante; clicar no «0» da barra recomeça o movimento.
- **Equação de movimento e solução**: a equação diferencial com os termos presentes, em símbolos e com os
  valores atuais; o gráfico de *x*(*t*), ou θ(*t*); e, quando existe, a fórmula da solução com suas constantes.
- **Deduções** e **Referências**: dois painéis no fim da página, um sobre o outro, fechados até que se clique no título.
  As deduções incluem uma seção sobre os caminhos para o caos no pêndulo forçado, sem e com atrito, com
  varreduras numéricas (os programas das varreduras não fazem parte da página).

A solução inteira, de *t* = 0 até a duração escolhida, é recalculada a cada mudança de um controle; a animação
apenas move um cursor de tempo sobre ela. Arrastar nos gráficos de energia e de *x*(*t*) move o cursor. O rodapé
diz como as curvas foram obtidas: «Calculado analiticamente» ou «Integração numérica», com o passo.

## Modelo

Oscilador:

    M x'' + b x' + k x + λ₃ x² + λ₄ x³ = F₀ cos(ω t)        V(x) = k x²/2 + λ₃ x³/3 + λ₄ x⁴/4

de modo que λ₃ e λ₄ multiplicam *x*² e *x*³ na força, e *x*³/3 e *x*⁴/4 no potencial.

Pêndulo, com θ o ângulo com a vertical a partir do ponto mais baixo. O atrito −*b v* e a força externa atuam
sobre a massa ao longo da trajetória (*v* = *L* θ'); os torques em relação ao ponto de suspensão dão

    M L² θ'' + b L² θ' + M g L sen θ = F₀ L cos(ω t)         V(θ) = M g L (1 − cos θ)

No oscilador o momento é *p* = *M x'* e a energia mostrada é *E* = *p*²/2*M* + *V*(*x*). No pêndulo o momento
conjugado a θ é o momento angular *p*_θ = *M L*² θ', e *E* = *p*_θ²/2*ML*² + *V*(θ); o diagrama de fase é
*p*_θ × θ, com θ reduzido a uma volta, −π < θ ≤ π. Unidades do SI.

O código trata os dois sistemas com as mesmas equações, *x'* = *p*/*I* e *p'* = −d*V*/d*x* − (*b*/*M*) *p* +
*G* cos(ω*t*), em que *I* é a massa ou o momento de inércia *ML*², e *G* é *F*₀ ou o torque *F*₀*L*
(`Fisica.inertia` e `Fisica.drive`).

Grandezas derivadas, todas da parte linear da força (para o pêndulo, sen θ ≈ θ):

| símbolo | definição | significado |
|---|---|---|
| ω₀ | √(*k*/*M*), ou √(*g*/*L*) | frequência angular natural |
| γ | *b*/2*M* | taxa de amortecimento: a amplitude livre cai como e^(−γ*t*) |
| ω₁ | √(ω₀² − γ²) | frequência angular da oscilação amortecida |
| *Q* | ω₀/2γ | fator de qualidade |
| ω_R | √(ω₀² − 2γ²) | frequência da força que dá a maior amplitude estacionária (existe se ω₀² > 2γ²) |
| ω₋, ω₊ | √(ω₀² + γ²) ∓ γ | extremos da faixa em que a potência média absorvida passa da metade da máxima |

Regimes: subamortecido (γ < ω₀), crítico (γ = ω₀, isto é, *b* = 2*M*ω₀) e superamortecido (γ > ω₀).

### Soluções fechadas

Quando existe solução fechada, as curvas são calculadas por ela, e não pela integração numérica.

Oscilador linear (λ₃ = λ₄ = 0): *x*(*t*) = *x*_h(*t*) + *x*_p(*t*), uma solução da equação sem força, que carrega
as condições iniciais, mais uma solução particular da equação forçada.

| caso | termo |
|---|---|
| sem amortecimento | *C*₁ cos(ω₀*t*) + *C*₂ sen(ω₀*t*) |
| subamortecido | e^(−γ*t*) [*C*₁ cos(ω₁*t*) + *C*₂ sen(ω₁*t*)] |
| crítico | (*C*₁ + *C*₂ *t*) e^(−γ*t*) |
| superamortecido | *C*₁ e^(−(γ−*q*)*t*) + *C*₂ e^(−(γ+*q*)*t*), com *q* = √(γ² − ω₀²) |
| forçado | + *A* cos(ω*t* − δ), com *A* = (*F*₀/*M*)/√((ω₀² − ω²)² + 4γ²ω²) e tan δ = 2γω/(ω₀² − ω²) |
| forçado em ω = ω₀, sem amortecimento | + (*F*₀/2*M*ω₀) *t* sen(ω₀*t*) |

Pêndulo sem atrito nem força externa, com κ² = *E*/(2*MgL*), em funções elípticas de Jacobi:

| caso | solução |
|---|---|
| oscilação (κ < 1) | sen(θ/2) = κ sn(ω₀*t* + *u*₀, κ); período 4*K*(κ)/ω₀ |
| rotação (κ > 1) | θ = 2 am(±κω₀*t* + *u*₀, 1/κ); uma volta em 2*K*(1/κ)/(κω₀) |
| separatriz (κ = 1) | sen(θ/2) = tanh(±ω₀*t* + *u*₀) |

Uma massa em repouso sobre um ponto de equilíbrio, sem força externa, aí permanece (também no instável).

As deduções estão no painel «Deduções» da página. Para o pêndulo, a curva tracejada «aproximação harmônica»
(desligada de início; liga-se sob o gráfico de θ(*t*)) é a solução da equação com sen θ ≈ θ; para o oscilador com termos anarmônicos,
é a solução com λ₃ = λ₄ = 0.

### Integração numérica

Nos outros casos (termos anarmônicos; pêndulo com atrito ou força externa): Runge–Kutta clássico de 4ª ordem
aplicado ao sistema de primeira ordem acima. Uma amostra a cada 5 ms é
guardada para os gráficos. O passo é de 1 ms e é reduzido quando o movimento é rápido: procura-se manter
(maior taxa do movimento) × (passo) ≤ 0,05, em que a taxa é a maior entre √(|*V''*|/*M*), *b*/*M*, ω e, no
pêndulo, a velocidade angular. O passo mínimo é de 25 µs e o total não passa de 1,5 milhão de passos.

Se o potencial não é confinante (λ₄ < 0, ou λ₄ = 0 com λ₃ ≠ 0), a massa pode ultrapassar a barreira e ir a
infinito em tempo finito. A integração para nesse instante, a página avisa, e o eixo do tempo termina aí. Os
gráficos mostram o movimento enquanto a massa está dentro do diagrama de fase, que nesse caso vai até 1,5 vez a
distância da barreira (onde o potencial cúbico volta ao valor do fundo do poço).

## O que as barras indicam

| barra | segmentos e marcas |
|---|---|
| *b* | azul: subamortecido; laranja: superamortecido; marcas em 0 e no valor crítico 2*M*ω₀ |
| *M*, *k* (ou *L*, *g*) | a mesma fronteira vista de cada parâmetro, com marca no seu valor crítico |
| *g* | marcas na Lua, na Terra e em Júpiter |
| ω | marcas em ω₀ e em ω_R; faixa verde de ω₋ a ω₊: potência absorvida acima de metade da máxima (largura 2γ) |
| λ₃, λ₄ | cor da própria barra: estável (um só poço); âmbar: biestável (dois poços); vermelho: instável (o potencial não confina) |
| *F*₀, condições iniciais, λ₃, λ₄, *t* | marca em 0 |

As marcas prendem o cursor da barra, para que o valor exato possa ser escolhido; clicar no rótulo de uma marca
também o escolhe. Com termos anarmônicos, e no pêndulo, as marcas de amortecimento e de ressonância referem-se à
parte linear: valem para pequenas amplitudes.

## Arquivos

    index.html            a página, com o texto das deduções e das referências
    css/estilo.css        estilo; todas as cores estão definidas no início, para os temas claro e escuro
    js/fisica.js          o modelo: grandezas derivadas, potencial, equilíbrios, soluções fechadas (inclusive
                          funções elípticas), Runge–Kutta e a escolha do passo
    js/formulas.js        equação e solução em LaTeX; formatação dos números
    js/controles.js       barra deslizante com segmentos e marcas; barra fina dos intervalos do diagrama
    js/graficos.js        os três gráficos (canvas)
    js/app.js             controles, exemplos, animação: o ponto de partida para mudar a página
    tests/teste_fisica.js testes do modelo
    vendor/katex/         KaTeX 0.16.11 (tipografia das fórmulas), licença MIT

Faixas, passos e valores iniciais dos controles estão em `GROUPS`, e os exemplos do menu em `EXAMPLES`, ambos no
início de `js/app.js`. Um exemplo novo é uma linha a mais nessa lista.

## Testes

    node tests/teste_fisica.js

Precisa apenas do node. São 19 testes. Verificam que: as fórmulas do oscilador linear satisfazem a equação de
movimento e as condições iniciais, e a integração numérica coincide com elas em todos os regimes, livres e
forçados; a amplitude estacionária é máxima em ω_R e a potência absorvida cai à metade em ω₋ e ω₊; os valores
críticos de cada parâmetro; a energia se conserva sem atrito nem força externa, também com termos anarmônicos; o
período do oscilador quártico é o da integral *T* = 4 ∫₀ᵃ d*x* / √(2(*E* − *V*)/*M*); a frequência a pequena
amplitude segue a correção de Landau e Lifshitz (§28); os equilíbrios e sua estabilidade; o escape pela barreira
do potencial cúbico; as funções elípticas coincidem com a quadratura direta; a solução exata do pêndulo satisfaz
a equação, conserva a energia e coincide com a integração numérica na oscilação, na rotação e na separatriz; as
equações em θ e *p*_θ, com atrito e força externa, são a segunda lei de Newton ao longo da trajetória; o
período do pêndulo e seu limite harmônico; o passo é reduzido quando o movimento é rápido; as barras percorrem
os extremos do intervalo e os múltiplos do passo; e todas as fórmulas exibidas são LaTeX válido.

Os testes cobrem o modelo e as fórmulas. A página em si (gráficos, controles) não tem testes automáticos.

## Licença

MIT (ver `LICENSE`). Bruno Mota, metaBIO, Instituto de Física, UFRJ.
