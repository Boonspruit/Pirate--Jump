# 🏴‍☠️ Pirate Jump

**Pirate Jump** is a fast-paced 2D infinite jumper game built in HTML5 Canvas, inspired by classic mobile arcade hits like *Doodle Jump*. You play as an agile pirate scaling an endless procedural seascape that transitions dynamically into space!

Dodge ghost enemies, collect gold coins to unlock new custom hats in the shop, bounce off springs, hitch a ride on parrots, and avoid barrages of cannon fire!

---

## ✨ Features

- **Seamless Dynamic Backgrounds:** The background dynamically crossfades from an ocean horizon to a fluffy daytime sky, twilight clouds, and eventually deep space as you climb higher.
- **Custom Delta-Time Physics:** Precise movement logic ensures the game runs consistently and identically across all desktop and mobile devices regardless of monitor refresh rates.
- **Responsive Controls:** Play with keyboard arrows on desktop or use highly tuned, low-pass filtered tilt controls on your phone for a snappy, responsive feel.
- **AI-Generated Pixel Art:** Features cute 16-bit assets including UI elements, character skins, and modular background tiles.
- **Crisp Retro Graphics:** A custom nearest-neighbor upscaling engine scales all assets perfectly, bypassing browser anti-aliasing to keep pixel art extremely sharp.
- **Combat & Hazards:** 
    - **Ghosts:** Dodge floating wraiths or bounce off their heads!
    - **Pirate Ships:** Survive against cannons on the walls that fire iron cannonballs across the screen.
- **Cosmetic Shop:** Collect gold coins and spend them in the store to buy and equip different hats like Viking helmets or King crowns! Your progress and high scores are saved automatically.

---

## 🎮 How To Play

The game runs instantly inside your web browser. No installations required!

### 🖥️ Desktop Player
1. Download or clone this repository.
2. Open the `index.html` file in any modern web browser.
3. Use your **Left Arrow Key** and **Right Arrow Key** to move the pirate. 

### 📱 Mobile Phone / Tablet
1. Navigate to the hosted website on your device.
2. Tap the `Start` button. If prompted, allow access to your device's motion sensors.
3. **Tilt your phone left and right** to move the pirate.

*(Pro-Tip: Walk off one side of the screen to instantly loop over and appear on the other side!)*

---

## 🛠️ Built With

- **HTML5 Canvas** for rendering the game world and rendering seamless tiled backgrounds.
- **Vanilla Javascript** for all game logic, physics, asset scaling, and saving systems.
- **GSAP** for smooth menu animations.
- **Web Audio API** for retro synthesized sound effects.
