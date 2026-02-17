# 3D Shooting Arena V3

A browser-based 3D shooting game prototype with multiple modes, offline bots, scoping, perspective toggle, and saved presets.

## Features
- **Modes:** TDM, DM, and FFA.
- **Offline bots:** Rookie, Veteran, and Pro behavior profiles.
- **Detailed rifle model:** multi-part 3D gun with scope + rail.
- **Scoping:** hold right mouse button for scoped zoom + scope overlay.
- **Perspective toggle:** press `F3` to switch first-person / third-person camera.
- **V3 Save:** save preferred mode/difficulty/perspective to local storage using **Save V3**.
- **Live match HUD:** timer, team score, player score, kills, and deaths.

## Run
From repository root:

```bash
python3 -m http.server 4173
```

Open in browser:

```text
http://localhost:4173
```

## Controls
- `W/A/S/D` move
- `Shift` sprint
- `Mouse` aim
- `Left click` shoot
- `Right click (hold)` scope
- `F3` change perspective
- Click screen to enable pointer lock

## Next Features You Can Add
- Real map collision + navmesh pathfinding.
- Weapon classes (SMG, sniper, shotgun) with recoil patterns.
- Match objectives (capture points, bomb mode).
- Better animation rigs for player and bots.
