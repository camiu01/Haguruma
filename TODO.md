# TODO

Development task management for the Haguruma vehicle dynamics simulator and PWA conversion.

## Mobile and PWA

- [ ] Adapt layout and touch targets for small mobile screens #ui #mobile
- [ ] Move preset selector outside the primary view on mobile to a modal drawer #ui #mobile
- [ ] Move share trigger to header or floating action outside main flow on mobile #ui #mobile
- [ ] Enable responsive canvas scaling for high-DPI screens #ui #canvas
- [ ] Prevent mobile virtual keyboard from breaking layout anchors #ui #mobile
- [ ] Create manifest.webmanifest with standalone display configuration #pwa
- [ ] Implement service worker for offline asset caching #pwa
- [ ] Add install app prompt hook #pwa

## Simulation Engine

- [ ] Implement time-step numerical solver for 0-100 kmh and quarter mile #physics #simulation
- [ ] Add rotational inertia equivalent mass calculation based on gear reduction #physics
- [ ] Add shift time delay parameter with torque cut during gear changes #physics #simulation
- [ ] Calculate optimal shift points using wheel thrust intersection #physics #algorithm

## Powertrain

- [ ] Add drivetrain layout efficiency selector for FWD RWD and AWD #powertrain
- [ ] Implement traction limit clamp based on friction coefficient #powertrain #physics
- [ ] Support custom CSV import for dyno torque and power curves #engine #data
- [ ] Build shift drops visualization component #ui #transmission

## Utility and Presets

- [ ] Implement highway cruising speed RPM and load checker #utility
- [ ] Expand presets database with verified factory vehicles #presets
- [ ] Implement chart export to PNG and SVG #export
- [ ] Add printable PDF summary generator #export
