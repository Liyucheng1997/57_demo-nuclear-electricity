# Nuclear Power Plant Visualization

Three.js interactive visualization that explains how a pressurized water reactor (PWR) nuclear power plant works — from a single U-235 fission event to 500 kV on the grid.

## Features

**Detailed cutaway models (half-section with hatched cut faces)**

- Reactor pressure vessel: closure head with CRDM nozzles, core barrel, downcomer, lower/upper core plates, 17×17-style fuel assemblies with spacer grids, rod cluster control assemblies driven by the rod slider, Cherenkov glow
- Coolant stream through the vessel: inlet → downcomer → lower plenum → up through the core (color shifts cold → hot) → outlet
- Magnified fuel rod callout: UO₂ pellets, zircaloy cladding, plenum spring
- Two-loop primary circuit inside the containment: steam generators (U-tube bundle colored hot → cold, tube support plates, feedwater ring, swirl-vane separators, dryers, boiling bubbles), pressurizer (heaters, spray, steam bubble), reactor coolant pumps, hot / cold / crossover legs
- Containment with steel liner, polar crane, operating deck grating, equipment hatch
- Turbine island: double-flow HP turbine and two LP turbines with rotating blade rows (transparent upper casing), moisture separator reheaters, 4-pole generator cutaway (N/S poles, rotating magnetic field lines, three-phase stator windings), exciter
- Condenser with cooling-water tube bundles, feedwater train (condensate pump, LP heater, deaerator, main feed pump, HP heater), main steam isolation valves
- Hyperbolic natural-draft cooling tower cutaway (fill, spray, rain, air flow, vapor plume), circulating water system, main transformer, isolated phase bus, gantry and lattice pylons

**Principle and process**

- Micro view of the chain reaction: thermal neutrons split U-235, fragments fly apart, 2–3 fast neutrons are moderated by water molecules, control rods absorb neutrons, U-238 captures
- 8 guided steps (overview, fission, reactor, primary loop, steam generator, turbine, generator & grid, condensing & cooling) with explanations, key figures and camera fly-throughs
- Energy conversion chain with live values: nuclear → heat → steam → mechanical → electric, plus waste heat

**Interactive simulation**

- Control rod insertion drives reactor power (super-critical / critical / sub-critical states), coolant temperature, steam flow and electric output
- Emergency shutdown (SCRAM): rods drop, the turbine trips and coasts down, decay heat keeps going
- Click equipment in 3D to jump to its step, auto tour, labels / building shell toggles, X-ray ghosting where equipment blocks the view, animation speed, keyboard ← → and Space
- Bloom, outline highlighting, shadows, responsive desktop and mobile layout

## Project Structure

```
src/
  main.js                  renderer, post-processing, simulation, step logic, UI
  data/steps.js            step content, cameras, highlighted systems
  core/                    materials & shaders, geometry helpers, registry (labels, fluids, particle streams)
  plant/reactorBuilding.js containment, pressure vessel, steam generators, pressurizer, pumps, primary piping
  plant/turbineIsland.js   turbines, generator, MSR, condenser, feedwater train
  plant/coolingAndGrid.js  cooling tower, circulating water, transformer, transmission lines
  plant/site.js            sky, ground, lighting, turbine hall, auxiliary buildings, main steam / feedwater lines
  fission/fissionScene.js  micro-scale chain reaction scene
```

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build

```bash
npm run build
```

## Version

- `v1.1.0`: detailed cutaway models, fission micro view, interactive reactor simulation
- `v1.0.0`: initial release
