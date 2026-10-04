<!-- MLBB Post-Match Result Overlay - Asset Separated Layout -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>TCO Esports Post-Match Statistics Broadcast Overlay</title>
<!-- External Tailwind CSS v3 CDN with Plugins -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Tailwind Configuration -->
<script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              dark: '#070a10',
              panel: '#0d131e',
              border: '#1b2537',
              cyan: '#00d2ff',
              red: '#ff2d55',
              gold: '#ffb703',
              purple: '#9d4edd',
            }
          },
          fontFamily: {
            rajdhani: ['Rajdhani', 'sans-serif'],
            orbitron: ['Orbitron', 'sans-serif'],
            mono: ['Space Mono', 'monospace'],
          }
        }
      }
    }
  </script>
<!-- Google Web Fonts for Broadcast Esports Typography -->
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800;900&amp;family=Rajdhani:wght@500;600;700;800&amp;family=Space+Mono:wght@700&amp;display=swap" rel="stylesheet"/>
<!-- Core Component Styles -->
<style data-purpose="base-styling">
    body {
      background-color: #05070c;
      color: #e2e8f0;
      font-family: 'Rajdhani', sans-serif;
      overflow-x: hidden;
      user-select: none;
    }

    /* Broadcast Subtle Carbon Grid Background */
    .broadcast-grid-bg {
      background-color: #080b12;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(25, 45, 80, 0.45) 0%, transparent 65%),
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 100% 100%, 32px 32px, 32px 32px;
    }

    /* Slanted geometric cutouts */
    .clip-slant-left {
      clip-path: polygon(0% 0%, 94% 0%, 100% 100%, 0% 100%);
    }
    .clip-slant-right {
      clip-path: polygon(6% 0%, 100% 0%, 100% 100%, 0% 100%);
    }
    .clip-tag {
      clip-path: polygon(0 0, 85% 0, 100% 100%, 0% 100%);
    }
  </style>
<style data-purpose="item-spell-slots">
    /* High contrast item and spell asset slots */
    .slot-item {
      position: relative;
      background: linear-gradient(135deg, #151d2c 0%, #0c121d 100%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.8);
      transition: border-color 0.2s ease;
    }
    .slot-item:hover {
      border-color: rgba(255, 183, 3, 0.6);
    }
    
    .slot-spell {
      background: radial-gradient(circle at center, #1b283d 0%, #0e1522 100%);
      border: 1.5px solid #2a3c5a;
      box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
    }
    
    .slot-emblem {
      background: linear-gradient(145deg, #201a35 0%, #0e0d18 100%);
      border: 1.5px solid #633394;
    }

    .hero-card-glow-blue {
      box-shadow: inset 0 0 15px rgba(0, 210, 255, 0.15), 0 2px 8px rgba(0, 0, 0, 0.7);
    }
    
    .hero-card-glow-red {
      box-shadow: inset 0 0 15px rgba(255, 45, 85, 0.15), 0 2px 8px rgba(0, 0, 0, 0.7);
    }
  </style>
</head>
<body class="broadcast-grid-bg min-h-screen flex items-center justify-center p-2 lg:p-4">
<!-- BEGIN: MainBroadcastContainer -->
<!-- 16:9 Standard Esports Broadcast Ratio Master Container -->
<main class="w-full max-w-[1580px] bg-slate-950/90 border border-slate-800/80 shadow-[0_0_50px_rgba(0,0,0,0.9)] rounded-md overflow-hidden flex flex-col justify-between" data-purpose="broadcast-overlay-card">
<!-- BEGIN: TopTickerBar -->
<!-- Top Running Tournament Ticker Banner matching official broadcast -->
<div class="w-full bg-gradient-to-r from-red-600 via-brand-border to-red-600 h-6 flex items-center justify-between px-4 text-[10px] font-bold tracking-[0.25em] text-white/90 uppercase border-b border-white/10" data-purpose="tournament-ticker">
<div class="flex items-center space-x-6 overflow-hidden">
<span class="text-red-300 font-extrabold flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span> PLAYOFFS</span>
<span class="opacity-70">MPL INDONESIA SEASON 13</span>
<span class="opacity-70 hidden sm:inline">MATCH 70 • GAME 2</span>
<span class="opacity-70 hidden md:inline">ROAD TO GRAND FINALS</span>
</div>
<div class="flex items-center space-x-6 text-right">
<span class="opacity-70">BEST OF 5 SERIES</span>
<span class="text-yellow-400 font-black">GAME RESULT: FINAL</span>
</div>
</div>
<!-- END: TopTickerBar -->
<!-- BEGIN: MainHeader -->
<!-- Head-to-Head Team Header with Total Kills & Tournament Centerpiece -->
<header class="relative px-4 py-3 bg-gradient-to-b from-slate-900/95 to-slate-950/95 border-b border-slate-800 flex items-stretch justify-between" data-purpose="match-header">
<!-- LEFT TEAM: VICTORY / LIQUID AURA -->
<div class="flex-1 flex items-center justify-start space-x-4">
<!-- Team Status Banner -->
<div class="bg-gradient-to-r from-red-600 to-rose-700 text-white px-5 py-2.5 rounded clip-slant-left shadow-lg flex flex-col justify-center min-w-[210px]">
<span class="text-xs uppercase tracking-widest text-red-200 font-bold">MATCH WINNER</span>
<h1 class="text-2xl lg:text-3xl font-black italic tracking-wider leading-none text-white drop-shadow">LIQUID AURA</h1>
<span class="text-[11px] font-extrabold tracking-widest text-emerald-300 flex items-center gap-1 mt-0.5">
<svg class="w-3 h-3 fill-current" viewbox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg> VICTORY
          </span>
</div>
<!-- Team Emblem Logo Asset Slot -->
<div class="w-14 h-14 bg-slate-900 border-2 border-cyan-500/50 rounded-lg flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(0,210,255,0.2)]">
<svg class="w-full h-full text-cyan-400" fill="currentColor" viewbox="0 0 24 24">
<path d="M12 2L2 7l10 5 10-5-10-5zm0 8.7L4.5 7.2 12 4.1l7.5 3.1L12 10.7zM2 17l10 5 10-5-2.2-1.1L12 19.9l-7.8-4-2.2 1.1zM2 12l10 5 10-5-2.2-1.1L12 14.9l-7.8-4L2 12z"></path>
</svg>
</div>
<!-- Left Team Kill Scoreboard -->
<div class="text-center px-4">
<div class="text-5xl lg:text-6xl font-black font-orbitron tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]">
            27
          </div>
<div class="text-[10px] tracking-[0.2em] font-bold text-cyan-400">TEAM KILLS</div>
</div>
</div>
<!-- CENTER BADGE: Official MPL Playoffs Banner -->
<div class="flex flex-col items-center justify-center px-6 border-x border-slate-800/80">
<div class="flex items-center space-x-1.5 mb-1">
<span class="w-2 h-2 bg-red-500 rotate-45 inline-block"></span>
<span class="w-1.5 h-1.5 bg-red-400 rotate-45 inline-block opacity-75"></span>
<span class="w-1 h-1 bg-red-300 rotate-45 inline-block opacity-50"></span>
</div>
<div class="font-orbitron font-black text-2xl lg:text-3xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-200 to-red-500">
          PLAYOFFS
        </div>
<div class="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase mt-0.5">
          MPL ID SEASON 13
        </div>
<div class="text-[10px] tracking-wider text-slate-500 font-mono mt-0.5">
          MATCH 70 • GAME 2
        </div>
<div class="flex items-center space-x-1.5 mt-1.5">
<div class="w-6 h-1 bg-red-500 rounded-sm"></div>
<div class="w-6 h-1 bg-red-500 rounded-sm"></div>
<div class="w-6 h-1 bg-slate-700 rounded-sm"></div>
</div>
</div>
<!-- RIGHT TEAM: EVOS GLORY / DEFEAT -->
<div class="flex-1 flex items-center justify-end space-x-4">
<!-- Right Team Kill Scoreboard -->
<div class="text-center px-4">
<div class="text-5xl lg:text-6xl font-black font-orbitron tracking-tight text-slate-300 drop-shadow">
            13
          </div>
<div class="text-[10px] tracking-[0.2em] font-bold text-rose-400">TEAM KILLS</div>
</div>
<!-- Team Emblem Logo Asset Slot -->
<div class="w-14 h-14 bg-slate-900 border-2 border-rose-500/50 rounded-lg flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(255,45,85,0.2)]">
<svg class="w-full h-full text-rose-400" fill="currentColor" viewbox="0 0 24 24">
<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"></path>
</svg>
</div>
<!-- Defeat Banner -->
<div class="bg-gradient-to-l from-slate-800 to-slate-900 text-white px-5 py-2.5 rounded clip-slant-right border-r-4 border-slate-600 flex flex-col justify-center text-right min-w-[210px]">
<span class="text-xs uppercase tracking-widest text-slate-400 font-bold">RUNNER UP</span>
<h2 class="text-2xl lg:text-3xl font-black italic tracking-wider leading-none text-slate-200">EVOS GLORY</h2>
<span class="text-[11px] font-extrabold tracking-widest text-rose-400 flex items-center justify-end gap-1 mt-0.5">
<svg class="w-3 h-3 fill-current" viewbox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg> DEFEAT
          </span>
</div>
</div>
</header>
<!-- END: MainHeader -->
<!-- BEGIN: MatchBodyLayout -->
<!-- 3-Column Layout: Left Team (5 Players) | Center Match Objectives | Right Team (5 Players) -->
<div class="grid grid-cols-12 gap-2 lg:gap-3 p-3 flex-1 items-stretch" data-purpose="match-statistics-grid">
<!-- ========================================== -->
<!-- COLUMN 1: LEFT TEAM (5 PLAYER ROWS)       -->
<!-- No Player Face Photos - Pure Assets       -->
<!-- ========================================== -->
<div class="col-span-5 flex flex-col justify-between space-y-2" data-purpose="left-team-roster">
<!-- PLAYER 1: Gold Lane (Popol & Kupa) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-left-1">
<!-- Hero Portrait Card (Clean Asset Frame with Level & Hero Name) -->
<div class="flex items-center space-x-2 w-44 flex-shrink-0">
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-cyan-500/80 p-0.5 overflow-hidden hero-card-glow-blue">
<!-- Level Chip -->
<span class="absolute top-0 left-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-br font-mono z-10">13</span>
<!-- Hero Graphic Asset Slot -->
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-cyan-300">
<svg class="w-8 h-8 opacity-80" fill="none" stroke="currentColor" stroke-width="1.7" viewbox="0 0 24 24"><circle cx="12" cy="8" r="5"></circle><path d="M3 21v-2a7 7 0 0 1 14 0v2"></path></svg>
</div>
</div>
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-1 rounded uppercase">Gold Lane</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">POPOL &amp; KUPA</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
</div>
<!-- KDA & Gold Stats Block -->
<div class="text-left w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">2 / 0 / 7</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center gap-1 font-mono">
<span class="text-[9px] text-slate-400">GOLD</span> 10,500
            </div>
</div>
<!-- 6-Slot Item Build Grid (Dedicated Separated Assets) -->
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0" data-purpose="item-build-grid">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5" title="Swift Boots">
<div class="w-full h-full bg-amber-900/40 border border-amber-600/40 rounded flex items-center justify-center text-[9px] font-bold text-amber-300">BOOT</div>
</div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5" title="Demon Hunter Sword">
<div class="w-full h-full bg-purple-950 border border-purple-600/40 rounded flex items-center justify-center text-[9px] font-bold text-purple-300">DHS</div>
</div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5" title="Malefic Roar">
<div class="w-full h-full bg-cyan-950 border border-cyan-600/40 rounded flex items-center justify-center text-[9px] font-bold text-cyan-300">GUN</div>
</div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5" title="Corrosion Scythe">
<div class="w-full h-full bg-orange-950 border border-orange-600/40 rounded flex items-center justify-center text-[9px] font-bold text-orange-300">SCY</div>
</div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5" title="Blade of Despair">
<div class="w-full h-full bg-emerald-950 border border-emerald-600/40 rounded flex items-center justify-center text-[9px] font-bold text-emerald-300">BOD</div>
</div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5" title="Wind of Nature">
<div class="w-full h-full bg-sky-950 border border-sky-600/40 rounded flex items-center justify-center text-[9px] font-bold text-sky-300">WON</div>
</div>
</div>
<!-- Dedicated Battle Spell & Emblem Slots -->
<div class="flex items-center space-x-1.5 flex-shrink-0">
<!-- Battle Spell Asset Slot -->
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-amber-500/70" title="Battle Spell: Flicker">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600 flex items-center justify-center text-[9px] font-black text-black">
                FLK
              </div>
</div>
<!-- Emblem Tier Asset Slot -->
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-purple-500/60" title="Custom Marksman Emblem">
<svg class="w-5 h-5 text-purple-300" fill="currentColor" viewbox="0 0 24 24">
<path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10h2v4h-2zm0 6h2v2h-2z"></path>
</svg>
</div>
</div>
</div>
<!-- PLAYER 2: Jungler (Fredrinn) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-left-2">
<div class="flex items-center space-x-2 w-44 flex-shrink-0">
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-cyan-500/80 p-0.5 overflow-hidden hero-card-glow-blue">
<span class="absolute top-0 left-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-br font-mono z-10">13</span>
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-cyan-300">
<svg class="w-8 h-8 opacity-80" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"></path></svg>
</div>
</div>
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1 rounded uppercase">Jungler</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">FREDRINN</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
</div>
<div class="text-left w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">4 / 1 / 8</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center gap-1 font-mono">
<span class="text-[9px] text-slate-400">GOLD</span> 9,840
            </div>
</div>
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-blue-300">TGH</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-emerald-300">CUR</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-purple-300">ATH</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-rose-300">BLD</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-yellow-300">IMM</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-cyan-300">ICE</div></div>
</div>
<div class="flex items-center space-x-1.5 flex-shrink-0">
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-purple-500/70" title="Battle Spell: Retribution">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-purple-500 to-indigo-700 flex items-center justify-center text-[9px] font-black text-white">RET</div>
</div>
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-cyan-500/60" title="Custom Tank Emblem">
<svg class="w-5 h-5 text-cyan-300" fill="currentColor" viewbox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"></path></svg>
</div>
</div>
</div>
<!-- PLAYER 3: Mid Lane (Nathan) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-left-3">
<div class="flex items-center space-x-2 w-44 flex-shrink-0">
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-cyan-500/80 p-0.5 overflow-hidden hero-card-glow-blue">
<span class="absolute top-0 left-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-br font-mono z-10">13</span>
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-cyan-300">
<svg class="w-8 h-8 opacity-80" fill="currentColor" viewbox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
</div>
</div>
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-purple-400 bg-purple-950/60 border border-purple-800 px-1 rounded uppercase">Mid Lane</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">NATAN</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
</div>
<div class="text-left w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">2 / 2 / 6</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center gap-1 font-mono">
<span class="text-[9px] text-slate-400">GOLD</span> 9,195
            </div>
</div>
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-amber-300">FEA</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-purple-300">GLO</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-cyan-300">GEN</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-rose-300">HLV</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-emerald-300">WIN</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-yellow-300">IMM</div></div>
</div>
<div class="flex items-center space-x-1.5 flex-shrink-0">
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-cyan-500/70" title="Battle Spell: Purify">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-cyan-400 to-teal-600 flex items-center justify-center text-[9px] font-black text-black">PUR</div>
</div>
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-amber-500/60" title="Custom Mage Emblem">
<svg class="w-5 h-5 text-amber-300" fill="currentColor" viewbox="0 0 24 24"><path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29c-.39-.39-1.02-.39-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41l-2.33-2.35z"></path></svg>
</div>
</div>
</div>
<!-- PLAYER 4: EXP Lane (Paquito) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-left-4">
<div class="flex items-center space-x-2 w-44 flex-shrink-0">
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-cyan-500/80 p-0.5 overflow-hidden hero-card-glow-blue">
<span class="absolute top-0 left-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-br font-mono z-10">13</span>
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-cyan-300">
<svg class="w-8 h-8 opacity-80" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path></svg>
</div>
</div>
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-orange-400 bg-orange-950/60 border border-orange-800 px-1 rounded uppercase">EXP Lane</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">PAQUITO</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
</div>
<div class="text-left w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">5 / 3 / 4</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center gap-1 font-mono">
<span class="text-[9px] text-slate-400">GOLD</span> 8,920
            </div>
</div>
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-amber-300">WAR</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-red-300">HUN</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-cyan-300">MAL</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-purple-300">BRU</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-emerald-300">BOD</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-yellow-300">IMM</div></div>
</div>
<div class="flex items-center space-x-1.5 flex-shrink-0">
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-amber-500/70" title="Battle Spell: Flicker">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600 flex items-center justify-center text-[9px] font-black text-black">FLK</div>
</div>
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-rose-500/60" title="Custom Fighter Emblem">
<svg class="w-5 h-5 text-rose-300" fill="currentColor" viewbox="0 0 24 24"><path d="M14.5 12l2.5-2.5L14.5 7 13 8.5l-3.5-3.5L8 6.5 11.5 10 7 14.5 8.5 16 12 12.5l2.5 2.5-1.5 1.5 1.5 1.5 2.5-2.5L14.5 12z"></path></svg>
</div>
</div>
</div>
<!-- PLAYER 5: Roamer (Tigreal / Khufra) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-left-5">
<div class="flex items-center space-x-2 w-44 flex-shrink-0">
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-cyan-500/80 p-0.5 overflow-hidden hero-card-glow-blue">
<span class="absolute top-0 left-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-br font-mono z-10">13</span>
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-cyan-300">
<svg class="w-8 h-8 opacity-80" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"></path></svg>
</div>
</div>
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-sky-400 bg-sky-950/60 border border-sky-800 px-1 rounded uppercase">Roamer</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">KHUFRA</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
</div>
<div class="text-left w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">1 / 2 / 14</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center gap-1 font-mono">
<span class="text-[9px] text-slate-400">GOLD</span> 7,240
            </div>
</div>
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-amber-300">DOM</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-blue-300">ATH</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-cyan-300">BLD</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-purple-300">CUR</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-emerald-300">TGH</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-yellow-300">IMM</div></div>
</div>
<div class="flex items-center space-x-1.5 flex-shrink-0">
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-amber-500/70" title="Battle Spell: Flicker">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600 flex items-center justify-center text-[9px] font-black text-black">FLK</div>
</div>
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-cyan-500/60" title="Custom Support/Tank Emblem">
<svg class="w-5 h-5 text-cyan-300" fill="currentColor" viewbox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle></svg>
</div>
</div>
</div>
</div>
<!-- ========================================== -->
<!-- COLUMN 2: CENTER MATCH TIMELINE & OBJECTIVES -->
<!-- Global Game Duration & Head-to-Head Stats -->
<!-- ========================================== -->
<div class="col-span-2 bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-900/90 border border-slate-800/90 rounded p-2.5 flex flex-col justify-between items-center text-center shadow-inner" data-purpose="center-match-timeline">
<!-- Match Duration Header -->
<div class="w-full pb-2 border-b border-slate-800/80">
<div class="text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase">GAME DURATION</div>
<div class="text-4xl lg:text-5xl font-black font-orbitron text-white tracking-widest my-1 drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
            30:59
          </div>
<div class="flex items-center justify-center space-x-2 text-[10px] font-mono text-emerald-400">
<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
<span>MATCH CONCLUDED</span>
</div>
</div>
<!-- Global Gold Comparison Row -->
<div class="w-full py-2 border-b border-slate-800/80 flex items-center justify-around">
<div class="text-center">
<div class="text-lg lg:text-xl font-black font-orbitron text-brand-gold">31.5K</div>
<div class="text-[9px] font-bold text-cyan-400">TOTAL GOLD</div>
</div>
<!-- Gold Coin Center Icon -->
<div class="w-8 h-8 rounded-full bg-amber-500/10 border-2 border-amber-400/80 flex items-center justify-center shadow-[0_0_8px_rgba(255,183,3,0.5)]">
<span class="text-amber-400 font-extrabold text-sm">$</span>
</div>
<div class="text-center">
<div class="text-lg lg:text-xl font-black font-orbitron text-brand-gold">31.5K</div>
<div class="text-[9px] font-bold text-rose-400">TOTAL GOLD</div>
</div>
</div>
<!-- Match Objectives Vertical Stack (Lord, Turtle, Turret, Team Fights) -->
<div class="w-full flex-1 flex flex-col justify-around py-2 space-y-2">
<!-- Stat Row 1: Lord Kills -->
<div class="flex items-center justify-between px-2 bg-slate-900/60 py-1.5 rounded border border-slate-800/50">
<span class="text-xl font-black font-orbitron text-cyan-400 w-8 text-center">2</span>
<div class="flex flex-col items-center">
<svg class="w-5 h-5 text-amber-400" fill="currentColor" viewbox="0 0 24 24">
<path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"></path>
</svg>
<span class="text-[9px] font-bold text-slate-400 tracking-wider">LORD</span>
</div>
<span class="text-xl font-black font-orbitron text-rose-400 w-8 text-center">6</span>
</div>
<!-- Stat Row 2: Team Kills / Skull -->
<div class="flex items-center justify-between px-2 bg-slate-900/60 py-1.5 rounded border border-slate-800/50">
<span class="text-xl font-black font-orbitron text-cyan-400 w-8 text-center">3</span>
<div class="flex flex-col items-center">
<svg class="w-5 h-5 text-slate-300" fill="currentColor" viewbox="0 0 24 24">
<path d="M12 2C7.58 2 4 5.58 4 10c0 2.65 1.28 4.98 3.25 6.44.15.11.25.28.25.48V19c0 .55.45 1 1 1h7c.55 0 1-.45 1-1v-2.08c0-.2.1-.37.25-.48C18.72 14.98 20 12.65 20 10c0-4.42-3.58-8-8-8zm-2.5 10c-.83 0-1.5-.67-1.5-1.5S8.67 9 9.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 9 14.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"></path>
</svg>
<span class="text-[9px] font-bold text-slate-400 tracking-wider">EXECUTE</span>
</div>
<span class="text-xl font-black font-orbitron text-rose-400 w-8 text-center">3</span>
</div>
<!-- Stat Row 3: Turtle Secures -->
<div class="flex items-center justify-between px-2 bg-slate-900/60 py-1.5 rounded border border-slate-800/50">
<span class="text-xl font-black font-orbitron text-cyan-400 w-8 text-center">1</span>
<div class="flex flex-col items-center">
<svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewbox="0 0 24 24">
<path d="M12 2a10 10 0 0 0-10 10c0 4.41 2.87 8.14 6.84 9.47.38-.63.66-1.35.8-2.14C6.54 18.08 5 15.28 5 12c0-3.87 3.13-7 7-7s7 3.13 7 7c0 3.28-1.54 6.08-4.64 7.33.14.79.42 1.51.8 2.14 3.97-1.33 6.84-5.06 6.84-9.47A10 10 0 0 0 12 2z"></path>
</svg>
<span class="text-[9px] font-bold text-slate-400 tracking-wider">TURTLE</span>
</div>
<span class="text-xl font-black font-orbitron text-rose-400 w-8 text-center">2</span>
</div>
<!-- Stat Row 4: Turrets Destroyed -->
<div class="flex items-center justify-between px-2 bg-slate-900/60 py-1.5 rounded border border-slate-800/50">
<span class="text-xl font-black font-orbitron text-orange-400 w-8 text-center">5</span>
<div class="flex flex-col items-center">
<svg class="w-5 h-5 text-orange-400" fill="currentColor" viewbox="0 0 24 24">
<path d="M19 2h-2V1h-2v1h-2V1h-2v1H9V1H7v1H5v3h14V2zM6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6H6zm6 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"></path>
</svg>
<span class="text-[9px] font-bold text-slate-400 tracking-wider">TURRETS</span>
</div>
<span class="text-xl font-black font-orbitron text-orange-400 w-8 text-center">4</span>
</div>
<!-- Stat Row 5: Base Invasions / Team Fights -->
<div class="flex items-center justify-between px-2 bg-slate-900/60 py-1.5 rounded border border-slate-800/50">
<span class="text-xl font-black font-orbitron text-purple-400 w-8 text-center">6</span>
<div class="flex flex-col items-center">
<svg class="w-5 h-5 text-purple-400" fill="currentColor" viewbox="0 0 24 24">
<path d="M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"></path>
</svg>
<span class="text-[9px] font-bold text-slate-400 tracking-wider">FIGHTS</span>
</div>
<span class="text-xl font-black font-orbitron text-purple-400 w-8 text-center">9</span>
</div>
</div>
<!-- Tournament Destination Footer Brand -->
<div class="w-full pt-2 border-t border-slate-800/80">
<div class="text-[8px] font-mono tracking-widest text-slate-500 uppercase">OFFICIAL DESTINATION - GAMING &amp; ESPORTS</div>
<div class="text-xs font-black tracking-widest text-slate-300 font-orbitron mt-0.5">QIDDIYA</div>
</div>
</div>
<!-- ========================================== -->
<!-- COLUMN 3: RIGHT TEAM (5 PLAYER ROWS)      -->
<!-- Mirrored Layout: Spell -> Items -> KDA -> Hero -->
<!-- ========================================== -->
<div class="col-span-5 flex flex-col justify-between space-y-2" data-purpose="right-team-roster">
<!-- PLAYER 1: Gold Lane (Claude) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-right-1">
<!-- Dedicated Battle Spell & Emblem Slots -->
<div class="flex items-center space-x-1.5 flex-shrink-0">
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-amber-500/70" title="Battle Spell: Flicker">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600 flex items-center justify-center text-[9px] font-black text-black">FLK</div>
</div>
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-purple-500/60" title="Custom Marksman Emblem">
<svg class="w-5 h-5 text-purple-300" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10h2v4h-2zm0 6h2v2h-2z"></path></svg>
</div>
</div>
<!-- 6-Slot Item Build Grid -->
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-amber-300">BOOT</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-purple-300">DHS</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-cyan-300">GUN</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-emerald-300">ROA</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-rose-300">MAL</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-sky-300">WON</div></div>
</div>
<!-- KDA & Gold Stats Block -->
<div class="text-right w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">1 / 1 / 5</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center justify-end gap-1 font-mono">
              6,324 <span class="text-[9px] text-slate-400">GOLD</span>
</div>
</div>
<!-- Hero Portrait Card (Clean Asset Frame with Level & Hero Name) -->
<div class="flex items-center space-x-2 w-44 flex-shrink-0 justify-end text-right">
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800 px-1 rounded uppercase">Gold Lane</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">CLAUDE</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-rose-500/80 p-0.5 overflow-hidden hero-card-glow-red flex-shrink-0">
<span class="absolute top-0 right-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-bl font-mono z-10">13</span>
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-rose-300">
<svg class="w-8 h-8 opacity-80" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5zm-7 18a7 7 0 0 1 14 0H5z"></path></svg>
</div>
</div>
</div>
</div>
<!-- PLAYER 2: Jungler (Baxia / Lancelot) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-right-2">
<div class="flex items-center space-x-1.5 flex-shrink-0">
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-purple-500/70" title="Battle Spell: Retribution">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-purple-500 to-indigo-700 flex items-center justify-center text-[9px] font-black text-white">RET</div>
</div>
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-cyan-500/60" title="Custom Tank Emblem">
<svg class="w-5 h-5 text-cyan-300" fill="currentColor" viewbox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"></path></svg>
</div>
</div>
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-amber-300">TGH</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-blue-300">CUR</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-rose-300">GLO</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-cyan-300">DOM</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-purple-300">ICE</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-yellow-300">IMM</div></div>
</div>
<div class="text-right w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">0 / 3 / 2</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center justify-end gap-1 font-mono">
              3,252 <span class="text-[9px] text-slate-400">GOLD</span>
</div>
</div>
<div class="flex items-center space-x-2 w-44 flex-shrink-0 justify-end text-right">
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1 rounded uppercase">Jungler</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">BAXIA</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-rose-500/80 p-0.5 overflow-hidden hero-card-glow-red flex-shrink-0">
<span class="absolute top-0 right-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-bl font-mono z-10">13</span>
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-rose-300">
<svg class="w-8 h-8 opacity-80" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"></path></svg>
</div>
</div>
</div>
</div>
<!-- PLAYER 3: Mid Lane (Nana / Novaria) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-right-3">
<div class="flex items-center space-x-1.5 flex-shrink-0">
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-amber-500/70" title="Battle Spell: Flameshot">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-orange-500 to-amber-700 flex items-center justify-center text-[9px] font-black text-white">FLM</div>
</div>
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-purple-500/60" title="Custom Mage Emblem">
<svg class="w-5 h-5 text-purple-300" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10h2v4h-2zm0 6h2v2h-2z"></path></svg>
</div>
</div>
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-amber-300">ARC</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-blue-300">LTG</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-purple-300">CLO</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-rose-300">HOL</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-emerald-300">DIV</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-yellow-300">WTR</div></div>
</div>
<div class="text-right w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">2 / 4 / 3</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center justify-end gap-1 font-mono">
              5,480 <span class="text-[9px] text-slate-400">GOLD</span>
</div>
</div>
<div class="flex items-center space-x-2 w-44 flex-shrink-0 justify-end text-right">
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-purple-400 bg-purple-950/60 border border-purple-800 px-1 rounded uppercase">Mid Lane</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">NANA</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-rose-500/80 p-0.5 overflow-hidden hero-card-glow-red flex-shrink-0">
<span class="absolute top-0 right-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-bl font-mono z-10">13</span>
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-rose-300">
<svg class="w-8 h-8 opacity-80" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 15H9v-2h2zm0-4H9V7h2z"></path></svg>
</div>
</div>
</div>
</div>
<!-- PLAYER 4: EXP Lane (Terizla / Arlott) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-right-4">
<div class="flex items-center space-x-1.5 flex-shrink-0">
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-amber-500/70" title="Battle Spell: Flicker">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600 flex items-center justify-center text-[9px] font-black text-black">FLK</div>
</div>
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-rose-500/60" title="Custom Fighter Emblem">
<svg class="w-5 h-5 text-rose-300" fill="currentColor" viewbox="0 0 24 24"><path d="M14.5 12l2.5-2.5L14.5 7 13 8.5l-3.5-3.5L8 6.5 11.5 10 7 14.5 8.5 16 12 12.5l2.5 2.5-1.5 1.5 1.5 1.5 2.5-2.5L14.5 12z"></path></svg>
</div>
</div>
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-amber-300">WAR</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-blue-300">BLD</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-cyan-300">QUE</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-rose-300">DOM</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-emerald-300">ATH</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-yellow-300">IMM</div></div>
</div>
<div class="text-right w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">4 / 3 / 2</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center justify-end gap-1 font-mono">
              6,890 <span class="text-[9px] text-slate-400">GOLD</span>
</div>
</div>
<div class="flex items-center space-x-2 w-44 flex-shrink-0 justify-end text-right">
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-orange-400 bg-orange-950/60 border border-orange-800 px-1 rounded uppercase">EXP Lane</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">TERIZLA</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-rose-500/80 p-0.5 overflow-hidden hero-card-glow-red flex-shrink-0">
<span class="absolute top-0 right-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-bl font-mono z-10">13</span>
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-rose-300">
<svg class="w-8 h-8 opacity-80" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"></path></svg>
</div>
</div>
</div>
</div>
<!-- PLAYER 5: Roamer (Vexana / Minotaur) -->
<div class="bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 rounded p-2 flex items-center justify-between gap-2 shadow-sm transition-all" data-purpose="player-row-right-5">
<div class="flex items-center space-x-1.5 flex-shrink-0">
<div class="w-8 h-8 rounded-full slot-spell flex items-center justify-center border-amber-500/70" title="Battle Spell: Flicker">
<div class="w-6 h-6 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600 flex items-center justify-center text-[9px] font-black text-black">FLK</div>
</div>
<div class="w-8 h-8 rounded slot-emblem flex items-center justify-center border-cyan-500/60" title="Custom Tank Emblem">
<svg class="w-5 h-5 text-cyan-300" fill="currentColor" viewbox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"></path></svg>
</div>
</div>
<div class="grid grid-cols-3 grid-rows-2 gap-1 flex-shrink-0">
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-amber-300">DOM</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-blue-300">ATH</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-cyan-300">BLD</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-purple-300">CUR</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-emerald-300">TGH</div></div>
<div class="w-7 h-7 rounded slot-item flex items-center justify-center p-0.5"><div class="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[9px] font-bold text-yellow-300">IMM</div></div>
</div>
<div class="text-right w-24 flex-shrink-0">
<div class="text-[9px] font-extrabold text-slate-400 tracking-wider">KDA</div>
<div class="text-base font-black font-orbitron tracking-tight text-white">0 / 6 / 4</div>
<div class="text-[11px] font-bold text-brand-gold flex items-center justify-end gap-1 font-mono">
              4,120 <span class="text-[9px] text-slate-400">GOLD</span>
</div>
</div>
<div class="flex items-center space-x-2 w-44 flex-shrink-0 justify-end text-right">
<div class="overflow-hidden">
<span class="inline-block text-[9px] font-bold text-sky-400 bg-sky-950/60 border border-sky-800 px-1 rounded uppercase">Roamer</span>
<div class="text-xs font-black tracking-wide text-white uppercase truncate">VEXANA</div>
<div class="text-[11px] font-bold text-slate-400 tracking-wider">SUPER KENN</div>
</div>
<div class="relative w-14 h-14 rounded bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-rose-500/80 p-0.5 overflow-hidden hero-card-glow-red flex-shrink-0">
<span class="absolute top-0 right-0 bg-red-600 text-white font-extrabold text-[10px] px-1 py-0.2 rounded-bl font-mono z-10">13</span>
<div class="w-full h-full bg-slate-800 flex items-center justify-center text-rose-300">
<svg class="w-8 h-8 opacity-80" fill="currentColor" viewbox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"></path></svg>
</div>
</div>
</div>
</div>
</div>
</div>
<!-- END: MatchBodyLayout -->
<!-- BEGIN: BroadcastFooterInfo -->
<!-- Minimalist Broadcast Copyright and Production Data Bar -->
<footer class="w-full bg-slate-950 px-4 py-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500" data-purpose="broadcast-footer">
<div class="flex items-center space-x-4">
<span class="text-slate-400 font-bold uppercase tracking-wider">MOONTON GAMES © 2024</span>
<span class="hidden sm:inline">•</span>
<span class="hidden sm:inline">MPL INDONESIA OFFICIAL BROADCAST SYSTEM</span>
</div>
<div class="flex items-center space-x-3 font-mono">
<span class="text-cyan-400">WINNER: LIQUID AURA [1-1]</span>
<span class="text-slate-600">|</span>
<span class="text-slate-400">NEXT: GAME 3</span>
</div>
</footer>
<!-- END: BroadcastFooterInfo -->
</main>
<!-- END: MainBroadcastContainer -->
</body></html>

<!-- MLBB Draft Pick & Ban Overlay - Broadcast Match Header Layout -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>MLBB Official Tournament Draft Pick &amp; Ban Broadcast HUD</title>
<!-- Tailwind CSS v3 with Container Queries -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Google Fonts: Rajdhani & Orbitron for Authentic Esports Broadcast Aesthetics -->
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800;900&amp;family=Rajdhani:wght@600;700;800&amp;family=Teko:wght@600;700&amp;display=swap" rel="stylesheet"/>
<script data-purpose="tailwind-config">
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              cyan: '#00F2FE',
              cyanGlow: '#00D2FF',
              onicYellow: '#FFC700',
              rrqOrange: '#FA8231',
              darkBg: '#090B10',
              panelBg: '#0F131C',
              slotBg: '#141A26',
              accentRed: '#FF2E54',
              tealBanner: '#005963',
              borderCyan: 'rgba(0, 242, 254, 0.45)',
            }
          },
          fontFamily: {
            esports: ['Rajdhani', 'sans-serif'],
            display: ['Orbitron', 'sans-serif'],
            teko: ['Teko', 'sans-serif']
          }
        }
      }
    };
  </script>
<style data-purpose="global-layout">
    body {
      margin: 0;
      padding: 0;
      background-color: #06080d;
      background-image: 
        radial-gradient(circle at 50% 10%, rgba(0, 89, 99, 0.25) 0%, transparent 45%),
        linear-gradient(to bottom, rgba(5,7,12,0.88), #07090e);
      font-family: 'Rajdhani', sans-serif;
      overflow-x: hidden;
      color: #FFFFFF;
      user-select: none;
    }

    /* Esports Chamfered Cuts */
    .clip-hud-left {
      clip-path: polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%);
    }
    .clip-hud-center {
      clip-path: polygon(0 0, 100% 0, 96% 100%, 4% 100%);
    }
    .clip-coach-badge {
      clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
    }
    .clip-angled-banner {
      clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 14px 100%);
    }
    .ban-slot-cross::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(45deg, transparent 46%, rgba(255, 46, 84, 0.85) 48%, rgba(255, 46, 84, 0.85) 52%, transparent 54%),
                  linear-gradient(-45deg, transparent 46%, rgba(255, 46, 84, 0.85) 48%, rgba(255, 46, 84, 0.85) 52%, transparent 54%);
      pointer-events: none;
      z-index: 10;
    }
    .glow-cyan {
      box-shadow: 0 0 14px rgba(0, 242, 254, 0.45);
    }
    .glow-timer {
      text-shadow: 0 0 12px rgba(0, 242, 254, 0.7);
    }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-end p-2 lg:p-4 text-white">
<!-- BEGIN: DraftHUDWrapper -->
<main class="w-full max-w-[1920px] mx-auto flex flex-col items-center">
<!-- BEGIN: UpperHeaderRow (Coach Badges + Ban Rows + Sponsor & Turn Status Centerpiece) -->
<header class="w-full grid grid-cols-12 gap-1 items-end relative z-20 mb-[2px]">
<!-- LEFT SIDE: Coach & Blue Bans (5 Columns) -->
<section class="col-span-12 lg:col-span-5 flex flex-col justify-end" data-purpose="blue-team-coach-and-bans">
<div class="flex items-center gap-1.5 w-full">
<!-- Coach Indicator (No Face Art - Headset & Tactical Icon Only) -->
<div class="flex items-center bg-brand-panelBg border-l-2 border-brand-cyan px-2.5 py-1.5 w-44 h-11 shadow-md">
<div class="w-7 h-7 rounded bg-cyan-950/80 border border-brand-cyan/40 flex items-center justify-center mr-2">
<!-- Headset Esports SVG Icon -->
<svg class="w-4 h-4 text-brand-cyan" fill="currentColor" viewbox="0 0 24 24">
<path d="M12 2C6.48 2 2 6.48 2 12v6c0 1.66 1.34 3 3 3h3v-8H4v-1c0-4.41 3.59-8 8-8s8 3.59 8 8v1h-4v8h3c1.66 0 3-1.34 3-3v-6c0-5.52-4.48-10-10-10z"></path>
</svg>
</div>
<div class="flex flex-col">
<span class="text-[9px] uppercase tracking-wider text-cyan-400 font-bold leading-none">HEAD COACH</span>
<span class="text-sm font-black tracking-wider text-gray-100 font-display">COACH YEB</span>
</div>
</div>
<!-- Blue Bans Row (5 Slots with Grayscale Filter & Red Cross Ban Marker) -->
<div class="flex-1 flex gap-1 items-center justify-end">
<!-- Ban Slot 1 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 1</span>
<span class="text-[10px] text-gray-300 font-extrabold">MATH</span>
</div>
</div>
<!-- Ban Slot 2 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 2</span>
<span class="text-[10px] text-gray-300 font-extrabold">FANNY</span>
</div>
</div>
<!-- Ban Slot 3 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 3</span>
<span class="text-[10px] text-gray-300 font-extrabold">VALENT</span>
</div>
</div>
<!-- Ban Slot 4 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 4</span>
<span class="text-[10px] text-gray-300 font-extrabold">JOY</span>
</div>
</div>
<!-- Ban Slot 5 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 5</span>
<span class="text-[10px] text-gray-300 font-extrabold">DIGGIE</span>
</div>
</div>
</div>
</div>
</section>
<!-- CENTER: Main MPL Tournament Sponsor & Schedule Centerpiece (2 Columns) -->
<section class="col-span-12 lg:col-span-2 flex flex-col items-center" data-purpose="tournament-centerpiece">
<!-- Dangerous Grass Campaign Box -->
<div class="w-full bg-gradient-to-r from-teal-900 via-teal-700 to-cyan-900 border-t border-x border-cyan-400/50 py-1 px-3 text-center shadow-lg relative">
<div class="flex items-center justify-center space-x-1.5">
<!-- Grass/Leaf Icon -->
<svg class="w-4 h-4 text-emerald-300 animate-pulse" fill="currentColor" viewbox="0 0 24 24">
<path d="M12 2C6.5 2 2 6.5 2 12c0 3.58 2.5 7.55 7.15 9.77.37.18.85-.09.85-.5v-4.5c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v4.5c0 .41.48.68.85.5C19.5 19.55 22 15.58 22 12c0-5.5-4.5-10-10-10zm-1 10c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"></path>
</svg>
<span class="font-display font-black text-sm tracking-widest text-emerald-200">DANGEROUS GRASS</span>
</div>
</div>
<!-- Official Smartphone Sponsor Bar -->
<div class="w-full bg-[#081318] py-0.5 border-x border-cyan-900/60 text-center">
<p class="text-[7.5px] uppercase tracking-wider text-cyan-300/80 font-semibold leading-none">
            PRESENTED BY OFFICIAL TOURNAMENT SMARTPHONE
          </p>
<p class="text-[10.5px] font-black tracking-wide text-white leading-tight">
            SAMSUNG <span class="font-normal text-cyan-200">Galaxy S25 Series</span>
</p>
</div>
<!-- MPL Trophy Graphic & Match Phase Header -->
<div class="w-full bg-gradient-to-b from-[#0e1624] to-[#0a0e17] border-x border-cyan-500/30 px-2 py-1 flex items-center justify-between">
<span class="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">WEEK 9</span>
<!-- Shield/Trophy Emblem Badge -->
<div class="flex items-center space-x-1">
<div class="w-6 h-6 rounded bg-gradient-to-tr from-cyan-600 to-indigo-700 flex items-center justify-center shadow-sm border border-cyan-300/40">
<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewbox="0 0 24 24">
<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linecap="round" stroke-linejoin="round"></path>
</svg>
</div>
<span class="font-display font-extrabold text-[11px] text-white tracking-widest">MPL</span>
</div>
<div class="text-right">
<span class="text-[8px] block font-bold text-gray-400 leading-tight">MATCH 10</span>
<span class="text-[8px] block font-semibold text-cyan-400 leading-tight">SEASON 16</span>
</div>
</div>
</section>
<!-- RIGHT SIDE: Red Bans & Coach (5 Columns) -->
<section class="col-span-12 lg:col-span-5 flex flex-col justify-end" data-purpose="red-team-coach-and-bans">
<div class="flex items-center gap-1.5 w-full justify-between">
<!-- Red Bans Row (5 Slots with Grayscale Filter & Red Cross Ban Marker) -->
<div class="flex-1 flex gap-1 items-center justify-start">
<!-- Ban Slot 1 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 1</span>
<span class="text-[10px] text-gray-300 font-extrabold">CHOU</span>
</div>
</div>
<!-- Ban Slot 2 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 2</span>
<span class="text-[10px] text-gray-300 font-extrabold">RUBY</span>
</div>
</div>
<!-- Ban Slot 3 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 3</span>
<span class="text-[10px] text-gray-300 font-extrabold">NOLAN</span>
</div>
</div>
<!-- Ban Slot 4 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 4</span>
<span class="text-[10px] text-gray-300 font-extrabold">TIGREAL</span>
</div>
</div>
<!-- Ban Slot 5 -->
<div class="relative w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden ban-slot-cross">
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-slate-800/40">
<span class="text-[8px] font-bold text-gray-400 tracking-tighter">BAN 5</span>
<span class="text-[10px] text-gray-300 font-extrabold">ROGER</span>
</div>
</div>
</div>
<!-- Coach Indicator (No Face Art - Tactical Badge Only) -->
<div class="flex items-center justify-end bg-brand-panelBg border-r-2 border-brand-accentRed px-2.5 py-1.5 w-44 h-11 shadow-md">
<div class="flex flex-col text-right mr-2">
<span class="text-[9px] uppercase tracking-wider text-rose-400 font-bold leading-none">HEAD COACH</span>
<span class="text-sm font-black tracking-wider text-gray-100 font-display">NAVARI</span>
</div>
<div class="w-7 h-7 rounded bg-red-950/80 border border-rose-500/40 flex items-center justify-center">
<svg class="w-4 h-4 text-brand-accentRed" fill="currentColor" viewbox="0 0 24 24">
<path d="M12 2C6.48 2 2 6.48 2 12v6c0 1.66 1.34 3 3 3h3v-8H4v-1c0-4.41 3.59-8 8-8s8 3.59 8 8v1h-4v8h3c1.66 0 3-1.34 3-3v-6c0-5.52-4.48-10-10-10z"></path>
</svg>
</div>
</div>
</div>
</section>
</header>
<!-- END: UpperHeaderRow -->
<!-- BEGIN: MainDraftRow (10 Hero Pick Columns + Center Countdown & Match Score Anchor) -->
<div class="w-full grid grid-cols-12 gap-1 items-stretch relative z-10">
<!-- LEFT SIDE (BLUE TEAM): 5 HERO PICK SLOTS -->
<section class="col-span-12 lg:col-span-5 grid grid-cols-5 gap-1" data-purpose="blue-team-hero-picks">
<!-- HERO 1: EXP LANE (Empty Slot Ready for Asset) -->
<article class="bg-[#0b0f17] border border-cyan-500/30 flex flex-col h-[270px] relative overflow-hidden group">
<!-- Role Indicator Tag -->
<div class="absolute top-1 left-1 z-20 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-cyan-400 border border-cyan-500/30 uppercase">
            EXP
          </div>
<!-- Hero Portrait Placeholder Box -->
<div class="flex-1 w-full bg-gradient-to-b from-[#131b28] via-[#0d131f] to-[#080b12] relative flex flex-col items-center justify-center p-2">
<svg class="w-10 h-10 text-cyan-500/30" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"></path>
</svg>
<span class="text-[10px] font-extrabold tracking-wider text-cyan-300/80 mt-1 uppercase">HERO PORTRAIT</span>
<span class="text-[8px] text-gray-500 uppercase tracking-tighter">PHOVEUS</span>
</div>
<!-- Spells / Emblem Mini Badges -->
<div class="h-6 bg-[#090d14] px-1.5 flex items-center justify-between border-t border-slate-800">
<span class="text-[8px] font-bold text-slate-400">FLICKER</span>
<span class="text-[8px] font-bold text-cyan-400">FIGHTER</span>
</div>
<!-- Player Name Bar -->
<footer class="h-7 bg-black flex items-center justify-center border-t-2 border-brand-cyan">
<span class="font-display font-black text-xs tracking-wider text-white">CADERAAA</span>
</footer>
</article>
<!-- HERO 2: JUNGLE -->
<article class="bg-[#0b0f17] border border-cyan-500/30 flex flex-col h-[270px] relative overflow-hidden group">
<div class="absolute top-1 left-1 z-20 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-cyan-400 border border-cyan-500/30 uppercase">
            JUNGLE
          </div>
<div class="flex-1 w-full bg-gradient-to-b from-[#131b28] via-[#0d131f] to-[#080b12] relative flex flex-col items-center justify-center p-2">
<svg class="w-10 h-10 text-cyan-500/30" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"></path>
</svg>
<span class="text-[10px] font-extrabold tracking-wider text-cyan-300/80 mt-1 uppercase">HERO PORTRAIT</span>
<span class="text-[8px] text-gray-500 uppercase tracking-tighter">HAYABUSA</span>
</div>
<div class="h-6 bg-[#090d14] px-1.5 flex items-center justify-between border-t border-slate-800">
<span class="text-[8px] font-bold text-slate-400">RETRIBUTION</span>
<span class="text-[8px] font-bold text-cyan-400">ASSASSIN</span>
</div>
<footer class="h-7 bg-black flex items-center justify-center border-t-2 border-brand-cyan">
<span class="font-display font-black text-xs tracking-wider text-white">ALBERTTT</span>
</footer>
</article>
<!-- HERO 3: ROAM / TANK -->
<article class="bg-[#0b0f17] border border-cyan-500/30 flex flex-col h-[270px] relative overflow-hidden group">
<div class="absolute top-1 left-1 z-20 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-cyan-400 border border-cyan-500/30 uppercase">
            ROAM
          </div>
<div class="flex-1 w-full bg-gradient-to-b from-[#131b28] via-[#0d131f] to-[#080b12] relative flex flex-col items-center justify-center p-2">
<svg class="w-10 h-10 text-cyan-500/30" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"></path>
</svg>
<span class="text-[10px] font-extrabold tracking-wider text-cyan-300/80 mt-1 uppercase">HERO PORTRAIT</span>
<span class="text-[8px] text-gray-500 uppercase tracking-tighter">GROCK</span>
</div>
<div class="h-6 bg-[#090d14] px-1.5 flex items-center justify-between border-t border-slate-800">
<span class="text-[8px] font-bold text-slate-400">CONCEAL</span>
<span class="text-[8px] font-bold text-cyan-400">TANK</span>
</div>
<footer class="h-7 bg-black flex items-center justify-center border-t-2 border-brand-cyan">
<span class="font-display font-black text-xs tracking-wider text-white">SUPER MARCO</span>
</footer>
</article>
<!-- HERO 4: ACTIVE PICK WITH LING HERO STATS / META INFOBOX (Exactly like reference) -->
<article class="bg-[#0f1422] border-2 border-brand-cyan flex flex-col h-[270px] relative overflow-hidden shadow-lg shadow-cyan-900/30">
<!-- Role & Active Selection Badge -->
<div class="absolute top-1 left-1 z-20 bg-brand-cyan text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
            MID
          </div>
<!-- Hero Infobox Overlay (Directly matching Ling stats box from Image 2) -->
<div class="flex-1 w-full bg-gradient-to-b from-[#162136] via-[#0d1320] to-[#060911] p-2 flex flex-col justify-between relative">
<div>
<span class="text-[9px] font-black tracking-wider text-cyan-300 uppercase block">HERO METRICS</span>
<h4 class="font-display font-black text-base text-white tracking-widest leading-tight">LING</h4>
</div>
<!-- Pick & Ban Statistics Mini Table -->
<div class="grid grid-cols-2 gap-1 py-1 border-y border-cyan-500/20 bg-black/40 px-1 rounded">
<div>
<span class="text-[7.5px] uppercase font-bold text-gray-400 block">PICK</span>
<span class="font-display font-black text-sm text-yellow-400">77<span class="text-[10px]">x</span></span>
</div>
<div class="text-right">
<span class="text-[7.5px] uppercase font-bold text-gray-400 block">BAN</span>
<span class="font-display font-black text-sm text-rose-400">99<span class="text-[10px]">x</span></span>
</div>
</div>
<!-- Win Rate -->
<div class="bg-black/50 px-1.5 py-0.5 rounded flex items-center justify-between">
<span class="text-[8px] font-bold text-gray-300 tracking-tight uppercase">WIN RATE</span>
<span class="font-display font-black text-xs text-brand-cyan">100.0%</span>
</div>
</div>
<div class="h-6 bg-[#090d14] px-1.5 flex items-center justify-between border-t border-cyan-800">
<span class="text-[8px] font-bold text-slate-400">PURIFY</span>
<span class="text-[8px] font-bold text-cyan-400">MAGE</span>
</div>
<footer class="h-7 bg-brand-cyan flex items-center justify-center">
<span class="font-display font-black text-xs tracking-wider text-black">KAIRI</span>
</footer>
</article>
<!-- HERO 5: GOLD LANE (Drafting State) -->
<article class="bg-[#0b0f17] border border-cyan-500/50 flex flex-col h-[270px] relative overflow-hidden group">
<div class="absolute top-1 left-1 z-20 bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
            GOLD
          </div>
<!-- Hero Portrait Container Ready For Asset -->
<div class="flex-1 w-full bg-gradient-to-b from-[#1b263b] via-[#0d131f] to-[#080b12] relative flex flex-col items-center justify-center p-2">
<svg class="w-10 h-10 text-cyan-400/40 animate-pulse" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"></path>
</svg>
<span class="text-[10px] font-extrabold tracking-wider text-cyan-300/90 mt-1 uppercase">LOCKING IN...</span>
<span class="text-[8px] text-yellow-400 uppercase font-bold tracking-tighter">HARITH</span>
</div>
<div class="h-6 bg-[#090d14] px-1.5 flex items-center justify-between border-t border-slate-800">
<span class="text-[8px] font-bold text-slate-400">PURIFY</span>
<span class="text-[8px] font-bold text-yellow-400">MARKSMAN</span>
</div>
<footer class="h-7 bg-black flex items-center justify-center border-t-2 border-brand-cyan">
<span class="font-display font-black text-xs tracking-wider text-white">CLAYY</span>
</footer>
</article>
</section>
<!-- CENTER MATCH ANCHOR: TIMER, ACTIVE ARROW & SCORE DASHBOARD (2 Columns) -->
<section class="col-span-12 lg:col-span-2 flex flex-col justify-between bg-black/95 border-x-2 border-b-2 border-cyan-500/40 relative shadow-2xl" data-purpose="match-timer-and-teams">
<!-- Live Countdown Timer Bar (Cyan Digital Display) -->
<div class="w-full bg-[#051119] border-b border-cyan-400/30 px-3 py-1.5 flex flex-col items-center justify-center relative">
<div class="flex items-center space-x-1.5">
<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
<span class="font-display font-black text-2xl text-brand-cyan tracking-widest leading-none glow-timer">00:40</span>
</div>
<!-- Realtime Progress Track -->
<div class="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
<div class="bg-gradient-to-r from-teal-400 to-cyan-400 h-full w-[65%] shadow-sm"></div>
</div>
</div>
<!-- Middle Draft Directional Arrow (Active Indicator Pointing to Left Team Draft Turn) -->
<div class="flex-1 flex flex-col items-center justify-center py-2 relative">
<div class="flex items-center justify-center space-x-3 w-full px-4">
<!-- Left Active Chevron (Pointing Left to ONIC Drafting) -->
<div class="flex items-center justify-center w-8 h-8 rounded bg-cyan-950/80 border border-brand-cyan text-brand-cyan animate-pulse shadow-lg">
<svg class="w-5 h-5 transform rotate-180" fill="currentColor" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" fill-rule="evenodd"></path>
</svg>
</div>
<!-- VS / Phase Label -->
<div class="text-center">
<span class="text-[9px] uppercase tracking-widest font-black text-cyan-300 block">DRAFT TURN</span>
<span class="text-xs font-display font-black text-white">BO5 SERIES</span>
</div>
<!-- Right Idle Indicator -->
<div class="flex items-center justify-center w-8 h-8 rounded bg-slate-900 border border-slate-700 text-slate-600">
<svg class="w-5 h-5" fill="currentColor" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" fill-rule="evenodd"></path>
</svg>
</div>
</div>
<!-- Series Score Bars -->
<div class="flex items-center justify-center space-x-6 mt-3">
<!-- Left Score (e.g. 1 Win) -->
<div class="flex space-x-1">
<div class="w-3.5 h-1.5 bg-brand-cyan rounded-xs shadow-sm"></div>
<div class="w-3.5 h-1.5 bg-slate-700 rounded-xs"></div>
<div class="w-3.5 h-1.5 bg-slate-700 rounded-xs"></div>
</div>
<span class="text-[10px] font-black text-gray-400">SCORE</span>
<!-- Right Score (e.g. 0 Wins) -->
<div class="flex space-x-1">
<div class="w-3.5 h-1.5 bg-slate-700 rounded-xs"></div>
<div class="w-3.5 h-1.5 bg-slate-700 rounded-xs"></div>
<div class="w-3.5 h-1.5 bg-slate-700 rounded-xs"></div>
</div>
</div>
</div>
<!-- Team Logos Footer Strip -->
<div class="w-full bg-[#0a0f18] grid grid-cols-2 border-t border-slate-800">
<!-- ONIC Blue Team Badge -->
<div class="p-1.5 flex items-center justify-center space-x-1.5 border-r border-slate-800 bg-cyan-950/20">
<!-- Team Mascot/Emblem -->
<div class="w-5 h-5 rounded-full bg-brand-onicYellow flex items-center justify-center text-black font-black text-[9px] shadow-sm">
              ON
            </div>
<span class="font-display font-black text-xs text-brand-onicYellow">ONIC</span>
</div>
<!-- RRQ Red Team Badge -->
<div class="p-1.5 flex items-center justify-center space-x-1.5 bg-red-950/20">
<span class="font-display font-black text-xs text-orange-400">RRQ</span>
<!-- Team Mascot/Emblem -->
<div class="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white font-black text-[9px] shadow-sm">
              RQ
            </div>
</div>
</div>
</section>
<!-- RIGHT SIDE (RED TEAM): 5 HERO PICK SLOTS -->
<section class="col-span-12 lg:col-span-5 grid grid-cols-5 gap-1" data-purpose="red-team-hero-picks">
<!-- HERO 1: EXP LANE (Empty Slot Ready for Asset) -->
<article class="bg-[#140b0f] border border-rose-500/30 flex flex-col h-[270px] relative overflow-hidden group">
<div class="absolute top-1 left-1 z-20 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-rose-400 border border-rose-500/30 uppercase">
            EXP
          </div>
<div class="flex-1 w-full bg-gradient-to-b from-[#241318] via-[#1a0d13] to-[#0e080b] relative flex flex-col items-center justify-center p-2">
<svg class="w-10 h-10 text-rose-500/30" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"></path>
</svg>
<span class="text-[10px] font-extrabold tracking-wider text-rose-300/80 mt-1 uppercase">HERO PORTRAIT</span>
<span class="text-[8px] text-gray-500 uppercase tracking-tighter">TERIZLA</span>
</div>
<div class="h-6 bg-[#12080c] px-1.5 flex items-center justify-between border-t border-slate-800">
<span class="text-[8px] font-bold text-slate-400">VENGEANCE</span>
<span class="text-[8px] font-bold text-rose-400">FIGHTER</span>
</div>
<footer class="h-7 bg-black flex items-center justify-center border-t-2 border-brand-accentRed">
<span class="font-display font-black text-xs tracking-wider text-white">SUPER MARCO</span>
</footer>
</article>
<!-- HERO 2: JUNGLE -->
<article class="bg-[#140b0f] border border-rose-500/30 flex flex-col h-[270px] relative overflow-hidden group">
<div class="absolute top-1 left-1 z-20 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-rose-400 border border-rose-500/30 uppercase">
            JUNGLE
          </div>
<div class="flex-1 w-full bg-gradient-to-b from-[#241318] via-[#1a0d13] to-[#0e080b] relative flex flex-col items-center justify-center p-2">
<svg class="w-10 h-10 text-rose-500/30" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"></path>
</svg>
<span class="text-[10px] font-extrabold tracking-wider text-rose-300/80 mt-1 uppercase">HERO PORTRAIT</span>
<span class="text-[8px] text-gray-500 uppercase tracking-tighter">KHALED</span>
</div>
<div class="h-6 bg-[#12080c] px-1.5 flex items-center justify-between border-t border-slate-800">
<span class="text-[8px] font-bold text-slate-400">RETRIBUTION</span>
<span class="text-[8px] font-bold text-rose-400">FIGHTER</span>
</div>
<footer class="h-7 bg-black flex items-center justify-center border-t-2 border-brand-accentRed">
<span class="font-display font-black text-xs tracking-wider text-white">KAIRI</span>
</footer>
</article>
<!-- HERO 3: MID LANE -->
<article class="bg-[#140b0f] border border-rose-500/30 flex flex-col h-[270px] relative overflow-hidden group">
<div class="absolute top-1 left-1 z-20 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-rose-400 border border-rose-500/30 uppercase">
            MID
          </div>
<div class="flex-1 w-full bg-gradient-to-b from-[#241318] via-[#1a0d13] to-[#0e080b] relative flex flex-col items-center justify-center p-2">
<svg class="w-10 h-10 text-rose-500/30" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"></path>
</svg>
<span class="text-[10px] font-extrabold tracking-wider text-rose-300/80 mt-1 uppercase">HERO PORTRAIT</span>
<span class="text-[8px] text-gray-500 uppercase tracking-tighter">HILOS</span>
</div>
<div class="h-6 bg-[#12080c] px-1.5 flex items-center justify-between border-t border-slate-800">
<span class="text-[8px] font-bold text-slate-400">REVITALIZE</span>
<span class="text-[8px] font-bold text-rose-400">TANK</span>
</div>
<footer class="h-7 bg-black flex items-center justify-center border-t-2 border-brand-accentRed">
<span class="font-display font-black text-xs tracking-wider text-white">CLAYY</span>
</footer>
</article>
<!-- HERO 4: ROAM SUPPORT -->
<article class="bg-[#140b0f] border border-rose-500/30 flex flex-col h-[270px] relative overflow-hidden group">
<div class="absolute top-1 left-1 z-20 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-rose-400 border border-rose-500/30 uppercase">
            ROAM
          </div>
<div class="flex-1 w-full bg-gradient-to-b from-[#241318] via-[#1a0d13] to-[#0e080b] relative flex flex-col items-center justify-center p-2">
<svg class="w-10 h-10 text-rose-500/30" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"></path>
</svg>
<span class="text-[10px] font-extrabold tracking-wider text-rose-300/80 mt-1 uppercase">HERO PORTRAIT</span>
<span class="text-[8px] text-gray-500 uppercase tracking-tighter">NANA</span>
</div>
<div class="h-6 bg-[#12080c] px-1.5 flex items-center justify-between border-t border-slate-800">
<span class="text-[8px] font-bold text-slate-400">FLICKER</span>
<span class="text-[8px] font-bold text-rose-400">MAGE</span>
</div>
<footer class="h-7 bg-black flex items-center justify-center border-t-2 border-brand-accentRed">
<span class="font-display font-black text-xs tracking-wider text-white">ALBERTTT</span>
</footer>
</article>
<!-- HERO 5: GOLD LANE -->
<article class="bg-[#140b0f] border border-rose-500/30 flex flex-col h-[270px] relative overflow-hidden group">
<div class="absolute top-1 left-1 z-20 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-rose-400 border border-rose-500/30 uppercase">
            GOLD
          </div>
<div class="flex-1 w-full bg-gradient-to-b from-[#241318] via-[#1a0d13] to-[#0e080b] relative flex flex-col items-center justify-center p-2">
<svg class="w-10 h-10 text-rose-500/30" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"></path>
</svg>
<span class="text-[10px] font-extrabold tracking-wider text-rose-300/80 mt-1 uppercase">HERO PORTRAIT</span>
<span class="text-[8px] text-gray-500 uppercase tracking-tighter">CLAUDE</span>
</div>
<div class="h-6 bg-[#12080c] px-1.5 flex items-center justify-between border-t border-slate-800">
<span class="text-[8px] font-bold text-slate-400">SPRINT</span>
<span class="text-[8px] font-bold text-yellow-400">MARKSMAN</span>
</div>
<footer class="h-7 bg-black flex items-center justify-center border-t-2 border-brand-accentRed">
<span class="font-display font-black text-xs tracking-wider text-white">CADERAAA</span>
</footer>
</article>
</section>
</div>
<!-- END: MainDraftRow -->
<!-- BEGIN: TournamentFooterTicker -->
<footer class="w-full flex items-center justify-between px-3 py-1 bg-black/90 border-t border-cyan-500/20 text-[10px] tracking-wider text-gray-400 font-semibold mt-1">
<div class="flex items-center space-x-2">
<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
<span class="text-white">LIVE BROADCAST</span>
<span class="text-slate-600">|</span>
<span>SERVER ID: 9021-ID</span>
</div>
<div class="font-display font-bold text-cyan-400 tracking-widest text-[11px]">
        MOBILE LEGENDS: BANG BANG PROFESSIONAL LEAGUE
      </div>
<div class="flex items-center space-x-3">
<span>PATCH 1.9.22</span>
<span class="text-slate-600">|</span>
<span class="text-gray-300 font-bold">ALL HEROES UNLOCKED</span>
</div>
</footer>
<!-- END: TournamentFooterTicker -->
</main>
<!-- END: DraftHUDWrapper -->
</body></html>