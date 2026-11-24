<!-- By Bruno Mota - METAbio -->
# Osciladores

Página interativa sobre o oscilador harmônico e anarmônico em uma dimensão, livre e forçado, com amortecimento.
Feita para o curso de Mecânica e Termodinâmica do IMPA Tech.

Para usar, abra `index.html` no navegador. Não há nada a instalar e a página funciona sem internet.

## O que a página mostra

- **Espaço de fase** (painel principal): a trajetória no plano *p* × *x*, sobre as curvas de energia constante do
  oscilador sem amortecimento nem força. Os pontos de equilíbrio aparecem como círculos cheios (estáveis) ou
  vazios (instáveis); pelas barreiras passa a separatriz, tracejada. No oscilador linear forçado e amortecido, a
  elipse tracejada é o regime estacionário. Arrastar no diagrama escolhe a condição inicial.
- **Energia** (painel lateral): energia cinética, potencial e total em função do tempo.
- **Controles**: *M*, *k*, *b*, λ₃, λ₄, *F*₀, ω, as condições iniciais *x*₀ e *p*₀ e a duração. As barras trazem
  segmentos coloridos e marcas (ver abaixo).
- **Equação de movimento e solução** (embaixo): a equação diferencial com os termos presentes, em símbolos e com
  os valores atuais; o gráfico de *x*(*t*); e, quando existe, a fórmula da solução com suas constantes.

A solução inteira, de *t* = 0 até a duração escolhida, é recalculada a cada mudança de um controle; a animação
apenas move um cursor de tempo sobre ela. Arrastar nos gráficos de energia e de *x*(*t*) move o cursor.

## Modelo

Equação de movimento:

    M x'' + b x' + k x + λ₃ x² + λ₄ x³ = F₀ cos(ω t)

A força conservativa deriva do potencial

    V(x) = k x²/2 + λ₃ x³/3 + λ₄ x⁴/4

de modo que λ₃ e λ₄ multiplicam *x*² e *x*³ na força, e *x*³/3 e *x*⁴/4 no potencial. O momento é *p* = *M x'* e a
energia mostrada é *E* = *p*²/2*M* + *V*(*x*). Unidades do SI.

Grandezas derivadas, todas da parte linear da força:

| símbolo | definição | significado |
|---|---|---|
| ω₀ | √(*k*/*M*) | frequência angular natural |
| γ | *b*/2*M* | taxa de amortecimento: a amplitude livre cai como e^(−γ*t*) |
| ω₁ | √(ω₀² − γ²) | frequência angular da oscilação amortecida |
| *Q* | ω₀/2γ | fator de qualidade |
| ω_R | √(ω₀² − 2γ²) | frequência da força que dá a maior amplitude estacionária (existe se ω₀² > 2γ²) |

Regimes: subamortecido (γ < ω₀), crítico (γ = ω₀, isto é, *b* = 2√(*kM*)) e superamortecido (γ > ω₀).

### Solução analítica (λ₃ = λ₄ = 0)

*x*(*t*) = *x*_h(*t*) + *x*_p(*t*): uma solução da equação sem força, que carrega as condições iniciais, mais uma
solução particular da equação forçada.

| caso | termo |
|---|---|
| sem amortecimento | *C*₁ cos(ω₀*t*) + *C*₂ sen(ω₀*t*) |
| subamortecido | e^(−γ*t*) [*C*₁ cos(ω₁*t*) + *C*₂ sen(ω₁*t*)] |
| crítico | (*C*₁ + *C*₂ *t*) e^(−γ*t*) |
| superamortecido | *C*₁ e^(−(γ−*q*)*t*) + *C*₂ e^(−(γ+*q*)*t*), com *q* = √(γ² − ω₀²) |
| forçado | + *A* cos(ω*t* − δ), com *A* = (*F*₀/*M*)/√((ω₀² − ω²)² + 4γ²ω²) e tan δ = 2γω/(ω₀² − ω²) |
| forçado em ω = ω₀, sem amortecimento | + (*F*₀/2*M*ω₀) *t* sen(ω₀*t*) |

Com termos anarmônicos não há solução em funções elementares, e a página mostra apenas a solução numérica.

### Solução numérica

Runge–Kutta clássico de 4ª ordem, com passo de 1 ms, aplicado ao sistema *x'* = *p*/*M*,
*p'* = −*b p*/*M* − *k x* − λ₃*x*² − λ₄*x*³ + *F*₀ cos(ω*t*). Uma amostra a cada 5 ms é guardada para os gráficos.

Se o potencial não é confinante (λ₄ < 0, ou λ₄ = 0 com λ₃ ≠ 0), a massa pode ultrapassar a barreira e ir a
infinito em tempo finito. A integração para nesse instante e a página avisa.

## O que as barras indicam

| barra | segmentos e marcas |
|---|---|
| *b* | azul: subamortecido; laranja: superamortecido; marca no valor crítico 2√(*kM*) |
| *k*, *M* | a mesma fronteira vista de *k* e de *M* (crítico em *k* = *b*²/4*M* e em *M* = *b*²/4*k*) |
| ω | marcas em ω₀ e em ω_R; faixa verde ω₀ ± γ, a meia largura da ressonância (só quando há ressonância) |
| λ₃, λ₄ | amarelo: o potencial tem um segundo poço; vermelho: o potencial não é confinante |

As marcas de amortecimento crítico e de ressonância prendem o cursor da barra, para que o valor exato possa ser
escolhido; clicar no rótulo de uma marca também o escolhe. Com termos anarmônicos essas marcas continuam se
referindo à parte linear: valem para pequenas amplitudes.

## Arquivos

    index.html            a página
    css/estilo.css        estilo; todas as cores estão definidas no início, para os temas claro e escuro
    js/fisica.js          o modelo: grandezas derivadas, potencial, equilíbrios, Runge–Kutta, solução analítica
    js/formulas.js        equação e solução em LaTeX; formatação dos números
    js/controles.js       barra deslizante com segmentos e marcas
    js/graficos.js        os três gráficos (canvas)
    js/app.js             controles, exemplos, animação: o ponto de partida para mudar a página
    tests/teste_fisica.js testes do modelo
    vendor/katex/         KaTeX 0.16.11 (tipografia das fórmulas), licença MIT

Faixas, passos e valores iniciais dos controles estão em `GROUPS`, e os exemplos do menu em `EXAMPLES`, ambos no
início de `js/app.js`. Um exemplo novo é uma linha a mais nessa lista.

## Testes

    node tests/teste_fisica.js

Precisa apenas do node. Os testes verificam que: as fórmulas analíticas satisfazem a equação de movimento e as
condições iniciais; a solução numérica coincide com elas em todos os regimes, livres e forçados; a energia se
conserva sem amortecimento nem força, também com termos anarmônicos; o período do oscilador quártico é o da
integral *T* = 4 ∫₀ᵃ d*x* / √(2(*E* − *V*)/*M*); a amplitude estacionária é máxima em ω_R; os equilíbrios e sua
estabilidade; o escape pela barreira do potencial cúbico; e que todas as fórmulas exibidas são LaTeX válido.

## Licença

MIT (ver `LICENSE`). Bruno Mota, metaBIO, Instituto de Física, UFRJ.
