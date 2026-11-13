/*
 * 📘 PARA LA DEFENSA — mobile/src/paletas.js — los colores de la app (modo claro y oscuro), definidos en Figma.
 * Cumplen el contraste de WCAG 2.2 AA (el texto normal tiene al menos 4,5:1). Ver DISENO.md y ACCESIBILIDAD.md.
 */
// Paletas de BELABARBERÍA: negro cálido + champán (identidad definida en Figma, ajustada a WCAG 2.2 AA).
// Contrastes medidos con diseno/contraste.mjs. Ver DISENO.md → Fase 2.
//
// Uso de los tokens:
//   gold       → champán COMO TEXTO o ícono (precios, enlaces, ítem activo).  ≥ 4,5:1 sobre todas las superficies
//   goldFill   → champán COMO RELLENO (botón principal, día/hora elegidos, burbuja propia)
//   sobreGold  → texto e íconos sobre goldFill (≥ 8:1)
//   border     → divisores decorativos · borderInput → contorno de campos y controles (≥ 3:1)
export const paletas = {
  oscuro: {
    modo: 'oscuro',
    bg: '#111111',          // nivel 0
    surface: '#1B1B1B',     // nivel 1: tarjetas, barra inferior
    surface2: '#262626',    // nivel 2: destacados, chips, segmentado
    surface3: '#303030',    // nivel 3: hojas y modales
    input: '#1B1B1B',
    border: '#333333',
    borderInput: '#7A756D',
    gold: '#D4BC98',
    goldFill: '#C5A880',
    goldSuave: 'rgba(197, 168, 128, 0.16)',
    text: '#F2EFEA',
    muted: '#B3AEA6',
    faint: '#9A958D',
    danger: '#FF8A80',
    dangerSuave: 'rgba(255, 138, 128, 0.14)',
    ok: '#5FD08F',
    okSuave: 'rgba(95, 208, 143, 0.14)',
    warning: '#F0B54A',
    warningSuave: 'rgba(240, 181, 74, 0.14)',
    info: '#8CB8F0',
    infoSuave: 'rgba(140, 184, 240, 0.14)',
    sobreGold: '#111111',
    tabBar: '#1B1B1B',
    errorBg: 'rgba(255, 138, 128, 0.10)',
    sombra: '#000000',
    sombraOpacidad: 0.45
  },
  claro: {
    modo: 'claro',
    bg: '#F6F3EE',
    surface: '#FFFFFF',
    surface2: '#EDE8E0',
    surface3: '#FFFFFF',
    input: '#FFFFFF',
    border: '#DDD6CB',
    borderInput: '#7D766C',
    gold: '#7A5A1F',
    goldFill: '#C5A880',
    goldSuave: 'rgba(197, 168, 128, 0.18)',
    text: '#161412',
    muted: '#55504A',
    faint: '#6B655D',
    danger: '#B3261E',
    dangerSuave: 'rgba(179, 38, 30, 0.09)',
    ok: '#1A6E3E',
    okSuave: 'rgba(26, 110, 62, 0.10)',
    warning: '#8A5A00',
    warningSuave: 'rgba(138, 90, 0, 0.10)',
    info: '#1F5E99',
    infoSuave: 'rgba(31, 94, 153, 0.10)',
    sobreGold: '#161412',
    tabBar: '#FFFFFF',
    errorBg: 'rgba(179, 38, 30, 0.07)',
    sombra: '#3A2E1C',
    sombraOpacidad: 0.12
  }
};
