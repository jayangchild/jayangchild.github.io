// 달마다의 디자인: 색 + 여백·모서리 그림.
// 그림은 여백과 모서리에만 둔다 (따라 쓰기 글자를 가리지 않게).
// 11월·12월은 승인된 디자인(pilsa/monthly.html)의 값을 그대로 옮겼다. 나머지 달도 같은 자리·크기를 쓴다.
//
// deco 항목: { slot, art, x, y, w, rot, op }  (x, y, w 단위 mm, A4 종이 왼쪽 위 기준)
// slot = 그림이 놓이는 자리. 그 자리에 올린 그림(PNG)을 넣으면 그 자리의 기본 그림은 숨긴다.

import { ART } from './art.js';

// 올린 그림을 넣는 자리 (mm). 그림은 이 칸 안에 비율을 지키며 맞춰 넣고, 끌어서 옮길 수 있다.
// zone = 그림이 움직일 수 있는 범위 (따라 쓰기 칸과 겹치지 않는 여백)
export const SLOTS = {
  bl: { name: '왼쪽 아래', x: 6, y: 250, w: 48, h: 42, ax: 0, ay: 1 },
  bc: { name: '아래 가운데', x: 62, y: 262, w: 86, h: 30, ax: 0.5, ay: 1 },
  br: { name: '오른쪽 아래', x: 150, y: 250, w: 50, h: 42, ax: 1, ay: 1 },
  tl: { name: '로고 옆', x: 42, y: 10, w: 12, h: 12, ax: 0.5, ay: 0.5 },
  r: { name: '오른쪽 가장자리', x: 194, y: 150, w: 9, h: 9, ax: 0.5, ay: 0.5 },
};
// 그림이 들어가도 되는 여백들 (mm). 끌어 옮긴 그림은 이 중 가장 가까운 곳 안으로 들어간다
export const ZONES = {
  bl: { x0: 5, y0: 252, x1: 205, y1: 291.5 },
  bc: { x0: 5, y0: 252, x1: 205, y1: 291.5 },
  br: { x0: 5, y0: 252, x1: 205, y1: 291.5 },
  tl: { x0: 41, y0: 9, x1: 62, y1: 32 },
  r: { x0: 193, y0: 40, x1: 205, y1: 250 },
};

const d = (slot, art, x, y, w, rot = 0, op = 1) => ({ slot, art, x, y, w, rot, op });

export const THEMES = {
  1: {
    name: '1월 · 새해 눈',
    colors: { frame: '#dde7f2', accent: '#3d6b9e', soft: '#e8f0f8', tab: '#6f97c4', line: '#c2d4e8' },
    titleDeco: [[ART.snow('#8db8cf'), -3, 1, 8, -10], [ART.mitten('#d9534f'), 'R-2', 2, 7, 15]],
    deco: [
      d('bl', ART.snowman(), 8, 249, 33),
      d('bl', ART.snow('#a9cbe0'), 42, 270, 9, 10),
      d('br', ART.mitten('#d9534f'), 178, 264, 17, 12),
      d('br', ART.mitten('#3d6b9e', '#ffffff'), 162, 270, 14, -14),
      d('br', ART.snow('#9fc3d9'), 152, 284, 7),
      d('tl', ART.snow('#8db8cf'), 46, 13, 7, 10, 0.9),
      d('r', ART.snow(), 195, 112, 6, 15, 0.55),
      d('r', ART.star('#f2c14e'), 196, 170, 5, 0, 0.55),
      d('r', ART.snow(), 195, 228, 7, 0, 0.5),
    ],
  },
  2: {
    name: '2월 · 사랑',
    colors: { frame: '#f6dfe4', accent: '#b9506a', soft: '#fbeaee', tab: '#d97c93', line: '#ecc3cd' },
    titleDeco: [[ART.heart('#e46f86'), -3, 2, 7, -14], [ART.heart('#f2a1b1'), 'R-2', 3, 6, 12]],
    deco: [
      d('bl', ART.letter(), 8, 258, 40, -4),
      d('bl', ART.heart('#f2a1b1'), 44, 255, 8, 14),
      d('br', ART.mug(), 170, 260, 28),
      d('br', ART.heart('#e46f86'), 160, 280, 9, -12),
      d('br', ART.heart('#f2a1b1'), 152, 286, 6, 10),
      d('tl', ART.heart('#e46f86'), 46, 13, 6, -15, 0.9),
      d('r', ART.heart('#f2a1b1'), 195, 112, 6, 15, 0.55),
      d('r', ART.snow('#c9b3c0'), 195, 170, 6, 0, 0.5),
      d('r', ART.heart('#e46f86'), 195, 228, 6, -10, 0.5),
    ],
  },
  3: {
    name: '3월 · 봄 새싹',
    colors: { frame: '#e2efcf', accent: '#5b8a2f', soft: '#eef6e2', tab: '#8cbb5a', line: '#c9dfac' },
    titleDeco: [[ART.sprout(), -4, 0, 9, -10], [ART.butterfly(), 'R-3', 2, 8, 18]],
    deco: [
      d('bl', ART.wateringCan(), 7, 258, 40),
      d('bl', ART.sprout(), 44, 276, 10),
      d('br', ART.flowerPot(), 172, 254, 26),
      d('br', ART.tulip('#f6cf6b'), 162, 270, 7, -8),
      d('br', ART.butterfly('#c9a0dc', '#f2c6e0'), 151, 280, 9, -12),
      d('tl', ART.leaf('#8cc152'), 46, 13, 7, -20, 0.9),
      d('r', ART.butterfly(), 195, 112, 7, 15, 0.55),
      d('r', ART.leaf('#a6d36a'), 195, 170, 6, 10, 0.5),
      d('r', ART.sprout(), 195, 228, 7, 0, 0.5),
    ],
  },
  4: {
    name: '4월 · 부활절',
    colors: { frame: '#e9e1f4', accent: '#7356a3', soft: '#f2edf9', tab: '#9d84c9', line: '#d3c6e8' },
    titleDeco: [[ART.egg('#f6cf6b'), -3, 1, 7, -14], [ART.egg('#9fd3e6'), 'R-2', 2, 7, 12]],
    deco: [
      d('bl', ART.eggBasket(), 7, 254, 40),
      d('bl', ART.chick(), 44, 276, 10),
      d('br', ART.lily(), 174, 252, 25),
      d('br', ART.egg('#f2a1b1'), 163, 278, 8, -10),
      d('br', ART.egg('#a6d36a', '#fff'), 154, 283, 7, 12),
      d('tl', ART.butterfly('#c9a0dc', '#f6cf6b'), 46, 13, 7, -15, 0.9),
      d('r', ART.egg('#b9a0dc'), 195, 112, 6, 15, 0.55),
      d('r', ART.leaf('#a6d36a'), 195, 170, 6, 0, 0.5),
      d('r', ART.egg('#9fd3e6'), 195, 228, 6, -10, 0.5),
    ],
  },
  5: {
    name: '5월 · 가정의 달',
    colors: { frame: '#fbe0d6', accent: '#c95a48', soft: '#fdece6', tab: '#e88a72', line: '#f2c4b6' },
    titleDeco: [[ART.carnation(), -4, -1, 8, -14], [ART.heart('#e8607a'), 'R-2', 3, 6, 12]],
    deco: [
      d('bl', ART.bouquet(), 7, 250, 38),
      d('bl', ART.heart('#f29ab0'), 44, 276, 7, 12),
      d('br', ART.balloons(), 176, 250, 23),
      d('br', ART.carnation('#d94a64'), 164, 268, 9, -10),
      d('br', ART.heart('#e46f86'), 153, 284, 6, -8),
      d('tl', ART.carnation('#e8607a'), 46, 12, 6, -15, 0.9),
      d('r', ART.heart('#f29ab0'), 195, 112, 6, 15, 0.55),
      d('r', ART.balloon('#f6c443'), 196, 168, 5, 0, 0.55),
      d('r', ART.carnation('#e8607a'), 195, 226, 6, -10, 0.5),
    ],
  },
  6: {
    name: '6월 · 비와 무지개',
    colors: { frame: '#d9efea', accent: '#2a8a7c', soft: '#e7f5f2', tab: '#5bb3a5', line: '#b7ddd5' },
    titleDeco: [[ART.raindrop('#7fb8e0'), -2, 2, 5, -10], [ART.cloud(), 'R-3', 3, 10, 0]],
    deco: [
      d('bl', ART.umbrella(), 8, 252, 34),
      d('bl', ART.raindrop('#9fd0ea'), 44, 270, 5),
      d('br', ART.rainbow(), 160, 262, 40),
      d('br', ART.leaf('#7bb661'), 152, 283, 8, -20),
      d('tl', ART.raindrop('#7fb8e0'), 47, 13, 5, 0, 0.9),
      d('r', ART.raindrop('#9fd0ea'), 196, 112, 5, 0, 0.55),
      d('r', ART.cloud('#ffffff', '#b7ddd5'), 194, 170, 8, 0, 0.6),
      d('r', ART.raindrop('#7fb8e0'), 196, 228, 5, 0, 0.5),
    ],
  },
  7: {
    name: '7월 · 여름 바다',
    colors: { frame: '#d5eaf5', accent: '#2577a8', soft: '#e5f2fa', tab: '#57a3cf', line: '#b5d6ea' },
    titleDeco: [[ART.shell('#f4b6a6'), -3, 2, 7, -14], [ART.starfish('#f29a6a'), 'R-2', 2, 7, 12]],
    deco: [
      d('bl', ART.whale(), 6, 260, 44),
      d('br', ART.sailboat(), 172, 258, 27),
      d('br', ART.shell('#f4b6a6'), 162, 281, 8, -12),
      d('br', ART.starfish('#f29a6a'), 152, 284, 7, 10),
      d('tl', ART.sun('#f6c443'), 46, 12, 7, 0, 0.9),
      d('r', ART.shell('#f4b6a6'), 195, 112, 6, 15, 0.55),
      d('r', ART.starfish('#f6c443'), 195, 170, 6, 0, 0.55),
      d('r', ART.shell('#9fd0ea'), 195, 228, 6, -10, 0.5),
    ],
  },
  8: {
    name: '8월 · 한여름',
    colors: { frame: '#fbefc4', accent: '#b9800f', soft: '#fdf6dc', tab: '#e6b43a', line: '#f0dc9a' },
    titleDeco: [[ART.sun('#f6c443'), -4, 0, 9, 0], [ART.leaf('#7bb661'), 'R-2', 3, 7, 20]],
    deco: [
      d('bl', ART.watermelon(), 7, 262, 40, -6),
      d('bl', ART.sun('#f6c443'), 40, 252, 10),
      d('br', ART.sunflower(), 176, 250, 23),
      d('br', ART.sunflower(), 162, 266, 15, -8),
      d('br', ART.leaf('#7bb661'), 152, 284, 7, -20),
      d('tl', ART.sun('#f6c443'), 46, 12, 7, 0, 0.9),
      d('r', ART.leaf('#8cc152'), 195, 112, 6, 15, 0.55),
      d('r', ART.sun('#f6c443'), 195, 170, 6, 0, 0.55),
      d('r', ART.leaf('#a6d36a'), 195, 228, 6, -10, 0.5),
    ],
  },
  9: {
    name: '9월 · 추석 보름달',
    colors: { frame: '#e1e2f3', accent: '#4b519a', soft: '#eceefa', tab: '#7a80c4', line: '#c6c9e6' },
    titleDeco: [[ART.moon('#f6d77a'), -3, 1, 8, 0], [ART.star('#f2c14e'), 'R-2', 3, 6, 12]],
    deco: [
      d('bl', ART.moonNight(), 6, 255, 44),
      d('br', ART.persimmonBranch(), 160, 262, 40),
      d('br', ART.dragonfly('#b5c0e8'), 152, 284, 8, -20),
      d('tl', ART.star('#f2c14e'), 46, 14, 6, 10, 0.9),
      d('r', ART.persimmon(), 195, 112, 6, 15, 0.55),
      d('r', ART.star('#f2c14e'), 196, 170, 5, 0, 0.55),
      d('r', ART.dragonfly('#b5c0e8'), 195, 228, 7, 20, 0.5),
    ],
  },
  10: {
    name: '10월 · 코스모스와 말씀',
    colors: { frame: '#f2dfee', accent: '#9b4a8c', soft: '#f8ecf5', tab: '#c47ab6', line: '#e2c3dc' },
    titleDeco: [[ART.cosmos(), -4, 1, 8, -10], [ART.dragonfly('#9fc8e8'), 'R-3', 2, 8, 20]],
    deco: [
      d('bl', ART.cosmosBunch(), 7, 250, 38),
      d('bl', ART.dragonfly('#9fc8e8'), 42, 262, 10, 20),
      d('br', ART.bible(), 166, 264, 32, -4),
      d('br', ART.chestnut(), 158, 282, 7, -10),
      d('tl', ART.cosmos('#ea8fc0'), 46, 13, 7, 0, 0.9),
      d('r', ART.cosmos('#f2b6d6'), 195, 112, 6, 15, 0.55),
      d('r', ART.dragonfly('#9fc8e8'), 195, 170, 7, 10, 0.5),
      d('r', ART.cosmos('#c46bb0'), 195, 228, 6, 0, 0.5),
    ],
  },
  11: {
    name: '11월 · 추수감사',
    colors: { frame: '#f7dfc3', accent: '#d9792b', soft: '#fcebd8', tab: '#eba25e', line: '#e9c9a6' },
    titleDeco: [[ART.maple('#e0663f'), -4, 0, 9, -20], [ART.ginkgo(), 'R-3', 2, 8, 25]],
    deco: [
      d('bl', ART.basket(), 7, 252, 40),
      d('bl', ART.wheat(), 41, 262, 12, 12),
      d('br', ART.pumpkin(), 167, 266, 30),
      d('br', ART.maple('#f0a040'), 158, 278, 9, 30),
      d('br', ART.acorn(), 151, 284, 7, -15),
      d('tl', ART.maple('#e0663f'), 46, 13, 7, -25, 0.9),
      d('r', ART.ginkgo(), 195, 115, 7, 30, 0.55),
      d('r', ART.maple('#e0663f'), 195, 175, 7, -10, 0.5),
      d('r', ART.apple(), 195, 228, 6, 0, 0.5),
    ],
  },
  12: {
    name: '12월 · 성탄',
    colors: { frame: '#d6eadf', accent: '#2f7a5b', soft: '#e6f3ec', tab: '#5aa283', line: '#b9d8c8' },
    titleDeco: [[ART.star(), -3, 1, 8, -12], [ART.snow('#8db8cf'), 'R-2', 3, 7, 0]],
    deco: [
      d('bl', ART.nativity(), 6, 252, 46),
      d('br', ART.tree(), 172, 252, 27),
      d('br', ART.gift(), 160, 279, 11),
      d('br', ART.gift('#3f8f68', '#d9534f'), 151, 283, 8, -6),
      d('tl', ART.star(), 46, 14, 6, 10, 0.9),
      d('r', ART.snow(), 195, 112, 6, 15, 0.55),
      d('r', ART.star('#f2c14e'), 196, 170, 5, 0, 0.55),
      d('r', ART.snow(), 195, 228, 7, 0, 0.5),
    ],
  },
};
