# JET Bullet Hell

Juego bullet hell por oleadas con sistema de tienda y 8 habilidades progresivas.
Hecho 100% en un solo archivo HTML — sin dependencias.

## Cómo jugar

Abre [index.html](index.html) en cualquier navegador moderno.

## Multijugador Steel Ball Run (misma WiFi)

Para correr la carrera 1v1 contra alguien en tu **misma red WiFi**, uno de los dos
levanta el servidor local (necesita Node.js):

```
node server.js
```

Eso imprime una URL tipo `http://192.168.1.20:8080`. **Los dos** abren esa URL en su
navegador (deben estar en la misma WiFi). En el menú: **🌐 STEEL BALL RUN ONLINE** →
uno pulsa **Crear partida** (se genera un nombre random tipo `feroz-bronco-48`) y el
otro pulsa **Ver partidas en la WiFi**, ve la sala en la lista y entra con un clic.
Cuando los dos ponen **LISTO**, arranca la carrera. Sin códigos, sin internet.

> Si abres el juego desde la web (GitHub Pages, sin servidor), el modo online cae a
> conexión por internet con un **código** de 6 dígitos vía WebRTC.

### Controles
- `WASD` / flechas — mover
- `Click` — atacar con el arma activa
- `1-8` — cambiar de arma (de las que tengas)
- `Q` / `E` / rueda del mouse / click en el hotbar — ciclar entre armas compradas
- `B` — abrir/cerrar tienda
- `R` — paralizar el tiempo (arma 5)
- `T` — rebobinar enemigos (arma 7)
- `M` — abrir panel sandbox (sólo modo sandbox)
- `ESC` — pausa
- `Espacio` — reiniciar al morir

## Modos

- **Fácil** — todo más barato, enemigos más débiles, daño jugador 1.5×
- **Normal** — balance estándar
- **Difícil** — costos más altos, enemigos más rápidos y duros
- **Sandbox** — empiezas con todo, 99 999 monedas y panel para ajustar daño/velocidad/spawn en vivo

## Armas (en orden de compra)

| # | Arma | Costo |
|---|---|---|
| 1 | Látigo Eléctrico Morado | gratis |
| 2 | Puños & Hilos | 25 |
| 3 | Puños Rompedores | 80 |
| 4 | Lluvia Mortal | 200 |
| 5 | Puños del Tiempo (Star Finger + paro de tiempo) | 500 |
| 6 | Pistola Vórtice | 1200 |
| 7 | Puños del Rebobinado (Return to Zero) | 3000 |
| 8 | Burbujas Infinitas | 7000 |

Cada arma supera a la anterior. Al terminar una oleada ganas +50 HP máximo y curación total.
