# Black Eye – Corvette Drive

A simple mobile-friendly 3D car driving game (three.js). Your Corvette C7 on your road, a flat green ground and a blue sky.

## Run it
The game loads a 3D model, so it must be served over http (opening `index.html` by double-click will not work):

```
python3 -m http.server 8000
```
then open `http://<your-ip>:8000` on the phone (or any static host – GitHub Pages, Netlify, etc.). Three.js is loaded from the jsDelivr CDN, so the device needs internet.

- Square track (default): `index.html`
- Circle track: `index.html?shape=circle` (or use the **Track** button)

## Controls
| Touch | Keyboard |
|---|---|
| Left joystick – steer | ← → / A D |
| GAS button | ↑ / W |
| BRAKE button (hold at standstill = reverse) | ↓ / S / Space |
| ⟲ Reset | R |
| ⛶ Fullscreen / landscape lock | |

Analog speedometer (km/h) is shown at the bottom centre (top right in portrait). Driving on the grass slows you down.

## What is in here
- `assets/car.glb` – your Corvette, converted from the 370 MB / 2.1 M-polygon OBJ to ~87 k triangles (1.6 MB). Wheels are separate so they spin and steer. The textures weren't in the archive, so each material has a flat PBR colour (edit them in the converter / or swap the glb later).
- `assets/road.obj` – your road piece, kept for reference. It is one straight 83.4 x 4.4 slab (with a slope), so it can't close a loop by itself; `js/track.js` uses its exact length, width and edge camber, flattens it, and lays it out as a closed loop. Width is scaled x1.8 (`ROAD.widthScale`) so the car has room.
- `js/physics.js` – arcade car model (0-100 km/h in ~3.7 s, top speed ~280 km/h).
- `js/track.js` – track layout and road mesh. `js/main.js` – rendering, controls, HUD.
- `npm test` – quick physics / track sanity checks.
