# MATH

Physics and unit model behind HAGURUMA. Every relation below is implemented in
`src/core/math/` (plus `src/core/units/unit-utils.ts` and
`src/config/drivetrain-eff.ts`) and mirrored by the test suites in `tests/`.

## 1. Design rules

- **Strict SI internally.** Torque in Nm, power in kW, force in N, speed in km/h,
  distance in m, time in s, angle speed in rev/min. Imperial display units
  (mph, cv) are applied **only at the output boundary**, never inside an
  iterative scan. This keeps `speedKmh`/`rpmFromKmh` round-trips from
  accumulating error across the shift search and spin scans.
- **Pure functions, defensive inputs.** Every exported function validates its
  inputs and returns a neutral value (`0`, `null`, or a null-result object)
  instead of throwing. The solver never propagates `NaN`/`Infinity`.
- **One source of truth per relation.** Unit constants (`KMH_PER_MPH`,
  `KW_TO_NM`) live in the math module that owns the conversion; callers import
  them rather than redefining.

## 2. Notation and constants

| Symbol | Meaning | Unit |
|:--|:--|:--|
| $n$ | engine speed | rev/min |
| $v$ | vehicle speed | km/h (SI loops convert to m/s) |
| $i_g$ | engaged gear ratio | – |
| $i_d$ | final drive ratio | – |
| $r_{\text{dyn}}$ | dynamic rolling radius | m |
| $\eta$ | drivetrain efficiency | [0, 1] |
| $\mu$ | road friction coefficient | – |
| $F_z$ | vertical wheel load | N |
| $C_{rr}$ | rolling-resistance coefficient | – |
| $C_L$ | lift (downforce) coefficient | – |
| $A$ | frontal / reference area | m² |

| Constant | Value | Source |
|:--|:--|:--|
| `KMH_PER_MPH` | 1.609344 | `speed-math.ts` |
| `KW_TO_NM` | $30000/\pi \approx 9549.2966$ | `engine-curve-core.ts` |
| `GRAVITY` | 9.81 m/s² | `aero-math.ts`, `dynamics-math.ts` |
| `AIR_DENSITY` ($\rho$) | 1.225 kg/m³ | `aero-math.ts` |
| `KW_TO_HP` | 1.35962 | `aero-math.ts` |
| `KGM_TO_NM` | 9.80665 | `dyno-csv.ts` |
| `ROLLING_FACTOR_DEFAULT` | 0.975 | `tire-math.ts` |
| `ROLLING_FACTOR_MIN / MAX` | 0.9 / 1.0 | `tire-math.ts` |
| `TIRE_GROWTH_REF_KMH` | 250 km/h | `tire-math.ts` |
| `TIRE_GROWTH_MAX` | 0.03 (3 %) | `tire-math.ts` |
| `ROLLING_SPEED_REF_KMH` | 160 km/h | `aero-math.ts` |
| `TORSEN_TBR` | 3.0 | `dynamics-math.ts` |
| `ENGINE_BRAKE_FRACTION` | 0.10 | `dynamics-math.ts` |
| `CURVE_MIN_RPM` | 1000 | `engine-curve-core.ts` |
| `POINTS_MIN/MAX_RPM` | 500 / 15000 | `engine-curve-core.ts` |
| `POINTS_MIN/MAX_NM` | 5 / 5000 | `engine-curve-core.ts` |
| `ANCHOR_SCAN_RPM` | 25 | `engine-curve-core.ts` |
| `POINT_TAIL_TAPER` | 0.10 | `engine-curve-core.ts` |
| `CURVE_STEP_RPM` | 50 | `traction-math.ts` |
| `QUARTER_MILE_M` | 402.33928 | `accel-math.ts` |
| `SIM_DT` | 0.01 s | `accel-math.ts` |
| `SIM_MAX_TIME_S` | 60 s | `accel-math.ts` |
| `SIM_MAX_SPEED_KMH` | 500 km/h | `accel-math.ts` |
| `MAX_CURVE_POINTS` | 64 | `dyno-csv.ts` |
| `CRUISE_MIN_RPM` | 1600 | `cruise-math.ts` |
| `CRUISE_HIGH_RPM_FRACTION` | 0.85 | `cruise-math.ts` |
| `TOP_SPEED_HARD_CAP` / `MIN_HIGH` | 600 / 400 km/h | `aero-math.ts` |

## 3. Tire model — `tire-math.ts`

### 3.1 Parsing

A tire string `205/55R16` (regex `^(\d{3})/(\d{2})\s*R?(\d{2})$`) yields:

$$
\text{sidewall} = w \cdot \frac{a}{100}, \qquad
\text{diameter} = d_{\text{rim}} \cdot 25.4 + 2\,\text{sidewall}, \qquad
C_{\text{geo}} = \pi \cdot \text{diameter}
$$

where $w$ is the section width (mm), $a$ the aspect ratio (%), $d_{\text{rim}}$
the rim diameter (inches). Output is the geometric circumference
`circumferenceM` (m).

### 3.2 Loaded rolling circumference

$$
C_{\text{eff}} = C_{\text{geo}} \cdot f_{\text{roll}}, \qquad
f_{\text{roll}} = \operatorname{clamp}(f, 0.9, 1.0),\quad f_{\text{default}} = 0.975
$$

The 0.975 factor is the ISO/ETRTO loaded-tire baseline (≈2.5 % squash). The
static load deflection is folded into this constant factor.

### 3.3 Centrifugal growth

$$
k_g(v) = 1 + \min\!\left(0.03,\; 0.03 \cdot \left(\frac{v}{250}\right)^2\right),
\qquad
C_{\text{dyn}}(v) = C_{\text{eff}} \cdot k_g(v)
$$

Quadratic in speed, capped at +3 % near 250 km/h. Dynamic radius used by the
traction and dynamics modules:

$$
r_{\text{dyn}} = \frac{C_{\text{dyn}}}{2\pi} \qquad(\text{`dynamicRadiusM` in traction-math.ts})
$$

### 3.4 Load-sensitive radius (v0.5.0)

Static squash from the per-tire vertical load $F$ (static share plus
downforce share) over the sidewall stiffness $k$ shrinks the geometric radius
before growth expands it (`loadedDynamicRadiusM`):

$$
r(v, F) = \max\!\left(\frac{r_{\text{geo}}}{2},\; r_{\text{geo}} - \frac{F}{k}\right) \cdot k_g(v),
\qquad r_{\text{geo}} = \frac{C_{\text{geo}}}{2\pi}
$$

Default $k = 450000$ N/m reproduces the 0.975 ISO factor at typical corner
loads ($\approx$ 3433 N per tire on a 1400 kg car); the half-radius floor
reads extreme overload as a flat tire instead of `NaN`.

## 4. Speed conversion — `speed-math.ts`

Core SI relations (km/h boundary):

$$
v = \frac{n}{i_g \, i_d}\cdot \frac{C_{\text{dyn}}}{1000}\cdot 60
\qquad\Longleftrightarrow\qquad
n = \frac{v \cdot 1000}{60 \cdot C_{\text{dyn}}}\cdot i_g \, i_d
$$

Implemented as `speedKmh` / `rpmFromKmh`. Display conversion is boundary-only:

$$
v_{\text{mph}} = v_{\text{kmh}} \cdot \frac{1}{1.609344}, \qquad
v_{\text{kmh}} = v_{\text{mph}} \cdot 1.609344
$$

`calculateSpeed` / `calculateRpm` wrap the SI core with the display factor;
internal scans call `speedKmh` / `rpmFromKmh` directly.

## 5. Engine curve model — `engine-curve-core.ts`

### 5.1 Torque ⇄ power

$$
T\,[\text{Nm}] = P\,[\text{kW}] \cdot \frac{KW\_TO\_NM}{n}
= P \cdot \frac{30000}{\pi \, n},
\qquad
P\,[\text{kW}] = \frac{T \cdot n}{KW\_TO\_NM}
$$

### 5.2 Anchor model (default)

Anchors: `peakTorqueRpm`, `peakTorqueNm`, `peakPowerRpm`, `peakPowerKw`, `redline`.
Validated by `validateCurve`: redline clamped to [3000, 12000], torque peak
RPM clamped to $[\text{CURVE\_MIN\_RPM}, \text{peakPowerRpm}]$, power peak RPM
clamped to $[\text{CURVE\_MIN\_RPM}, \text{redline}]$.

Power is piecewise-linear in RPM, with a torque ramp below peak torque:

$$
\text{for } n \le n_{T}:\quad
k = \frac{n - 1000}{n_T - 1000},\quad
T = T_{\max}\,(0.5 + 0.5k),\quad
P = \frac{T\,n}{KW\_TO\_NM}
$$

So torque rises from 50 % of peak at 1000 rpm to 100 % at the torque peak.

$$
\text{for } n_T < n \le n_P:\quad
P = P_{T} + (P_{\max} - P_{T})\,\frac{n - n_T}{n_P - n_T}
$$

where $P_T = T_{\max} n_T / KW\_TO\_NM$ is the power at the torque peak.

$$
\text{for } n_P < n \le n_{\text{red}}:\quad
P = P_{\max}\left(1 - 0.10 \cdot \frac{n - n_P}{n_{\text{red}} - n_P}\right),
\qquad \text{else } P = 0
$$

`engineTorqueAt` always returns $\text{torqueFromPower}(P(n), n)$ in anchor mode,
so torque and power stay physically consistent.

### 5.3 Measured dyno points

`sanitizeTorquePoints` keeps rows with $n \in [500, 15000]$ and
$T \in [5, 5000]$, rounds RPM, sorts and de-duplicates; fewer than two valid
rows disables the point model.

**Akima interpolation** (`torqueAtRpm`), used between measured nodes:

1. Segment slopes $m_i = \dfrac{T_{i+1}-T_i}{n_{i+1}-n_i}$.
2. Edge-padded slope array ($m_0, m_0, \dots, m_{k}, m_{k}$).
3. Akima weight per node:

$$
w_1 = |m_{i+3}-m_{i+2}|,\quad w_2 = |m_{i+1}-m_i|,
\qquad
t_i =
\begin{cases}
\dfrac{w_1 m_{i+1} + w_2 m_{i+2}}{w_1 + w_2}, & w_1+w_2>0\\[4pt]
\dfrac{m_{i+1}+m_{i+2}}{2}, & \text{otherwise}
\end{cases}
$$

4. Cubic Hermite on the segment, with $s = (n - n_i)/h$, $h = n_{i+1}-n_i$:

$$
T(s) = (2s^3-3s^2+1)T_i + (s^3-2s^2+s)h\,t_i
      + (-2s^3+3s^2)T_{i+1} + (s^3-s^2)h\,t_{i+1}
$$

5. The result is **segment-clamped** to $[\min(T_i,T_{i+1}), \max(T_i,T_{i+1})]$
   so monotone runs stay monotone and noisy rollers do not overshoot. With only
   two points it falls back to linear; outside the data range the end value is
   held.

**Dyno-tail taper.** Past the last measured RPM, power tapers toward the
limiter instead of extrapolating a rising curve:

$$
P(n) = P_{\text{last}}\left(1 - 0.10 \cdot k\right),\quad
k = \operatorname{clamp}\!\left(\frac{n - n_{\text{last}}}{n_{\text{red}} - n_{\text{last}}}, 0, 1\right)
$$

`anchorsFromPoints` derives consistent `peakTorque*` / `peakPower*` anchors by
scanning the interpolated curve in 25-rpm steps.

## 6. Dyno CSV parsing — `dyno-csv.ts`

- Delimiter auto-detected (most frequent of `;`, `,`, tab).
- Header row optional; column labels matched case-insensitively (`rpm|giri|rev`,
  `nm|coppia|torque|kgm|mkg`, `kw|cv|hp|ps|potenza|power`).
- Unit handling: torque `kgm → Nm` via 9.80665; power `cv/hp/ps → kW` via `hpToKw`.
- Power-only rows convert to torque with $T = P \cdot KW\_TO\_NM / n$.
- Optional Gaussian pre-filter `smoothTorquePoints`, kernel $[1,4,6,4,1]/16$,
  clamped-index edges.
- Savitzky-Golay pre-filter `smoothTorquePointsSG` (v0.5.0): quadratic fit
  over a 5-point window, kernel $[-3,12,17,12,-3]/35$, exact on smooth
  quadratics at interior nodes, clamped-index edges.
- Median pre-filter `smoothTorquePointsMedian` (v0.5.0): 5-sample median that
  kills single-sample roller-slip spikes averaging kernels only smear.
- Selector `smooth` accepts `true` (legacy Gaussian), `'gauss'`, `'sg'`,
  `'median'` or falsy (off).
- `resampleTorquePoints` caps the curve at `MAX_CURVE_POINTS = 64` by sampling
  `torqueAtRpm` on an even RPM grid (keeps share URLs compact).

## 7. Tractive force and optimal shift — `traction-math.ts`

### 7.1 Wheel force

$$
F_x(n) = \frac{T(n) \cdot i_g \, i_d \cdot \eta}{r_{\text{dyn}}}
$$

`tractiveForceAt` clamps $\eta$ to [0, 1] and returns 0 for non-positive
inputs. `dynamicRadiusM` returns $C/2\pi$.

### 7.2 Optimal shift RPM

At the **same road speed** $v$, the radius, final drive and efficiency cancel,
so

$$
F_{x,\,g}(v) > F_{x,\,g+1}(v)
\;\Longleftrightarrow\;
T(n_g)\, i_g > T(n_{g+1})\, i_{g+1},
\qquad
n_{g+1} = n_g \cdot \frac{i_{g+1}}{i_g}
$$

Define the signed force gap

$$
\Delta F(n) = F_{x,\,g+1}\!\big(n \cdot \tfrac{i_{g+1}}{i_g}\big) - F_{x,\,g}(n)
$$

`optimalShiftFor` finds the zero of $\Delta F$ by sampling every
`CURVE_STEP_RPM = 50` from 1000 rpm to redline, then picking the **last**
$-\to+$ crossing and accepting it only if $\Delta F$ stays $>0$ all the way to
the limiter. That backward-biased rule rejects low-RPM false positives from
turbo lag or non-monotonic curves. The bracket is refined by bisection to
25-rpm resolution. If no crossing qualifies, the shift point is the redline
(`atRedline = true`).

Output (`OptimalShift`): `shiftRpm`, landing RPM in the next gear, shift speed
in the display unit, and the redline flag. `optimalShiftsForAll` runs it for
every gear pair.

## 8. Shift kinematics — `shift-math.ts`

Kinematic landing RPM and drop at the limiter (no torque model, pure ratios):

$$
n_{\text{land}} = n_{\text{shift}} \cdot \frac{i_{\text{next}}}{i_{\text{curr}}},
\qquad
\Delta n = n_{\text{shift}} - n_{\text{land}},
\qquad
\Delta\% = \frac{\Delta n}{n_{\text{shift}}} \cdot 100
$$

`describeUpshift` validates each ratio into $[0.4, 6.0]$ and calls
`calculateSpeed` for the top speed. `judgeShifts` flags `bogging`
($n_{\text{land}} <$ band floor) and `warning` (within a margin above the
floor, default 400 rpm). `speedForLandingRpm` inverts the relation for a
desired landing RPM.

## 9. Road load — `aero-math.ts`

### 9.1 Forces

$$
F_{\text{drag}}(v) = \tfrac{1}{2}\,\rho\,C_d\,A\,v_{\text{ms}}^2,
\qquad v_{\text{ms}} = \frac{v_{\text{kmh}}}{3.6}
$$

Speed-sensitive rolling resistance (doubles past ~160 km/h):

$$
C_{rr}(v) = C_{rr,0}\left(1 + \frac{v}{160}\right),
\qquad
F_{\text{roll}}(v) = m\,g\,C_{rr}(v)
$$

Grade resistance (clamped to ±30 %):

$$
F_{\text{grade}} = m\,g\,\frac{s}{\sqrt{1+s^2}},
\qquad s = \frac{\text{grade\%}}{100}
$$

### 9.2 Power balance and drag-limited top speed

Wheel power required to hold a speed:

$$
P_{\text{load}}(v) = \big[F_{\text{drag}} + F_{\text{roll}} + F_{\text{grade}}\big]\cdot v_{\text{ms}}
$$

Available wheel power $P_{\text{avail}} = P_{\text{engine}} \cdot \eta$.
`dragLimitedSpeedKmh` bisects for $v$ such that
$P_{\text{load}}(v) = P_{\text{avail}}$:

1. Grow an upper bracket $v_{\text{high}} \in \{400, \dots\}$ by ×1.5 until
   $P_{\text{load}} > P_{\text{avail}}$ or the 600 km/h hard cap is hit.
2. 40 bisection steps.

On steep descents $F_{\text{grade}} < 0$ and $P_{\text{load}}$ can be negative
at low speed; the routine starts from the lowest positive-power point and
returns 0 if available power never exceeds the load. Saturation at the hard cap
is an instrumental limit, not a physical one.

Unit helpers: `kwToHp` / `hpToKw` with `KW_TO_HP = 1.35962`; `availableWheelKw`
clamps $\eta$ to ≤ 1.

## 10. Chassis dynamics — `dynamics-math.ts`

### 10.1 Static and dynamic axle loads

$$
F_{z,\text{front}} = m\,g\,d,\qquad F_{z,\text{rear}} = m\,g\,(1-d)
$$

Longitudinal transfer (rearward positive) with CoG height $h$ and wheelbase $L$:

$$
\Delta F_{\text{long}} = m\,a_x\,\frac{h}{L}
$$

Total lateral transfer, CoG height $h$ and track $T$:

$$
\Delta F_{\text{lat}} = m\,a_y\,\frac{h}{T},
\qquad a_y = \text{lateralG}\cdot g
$$

Per-wheel loads (`wheelLoads`): the rear axle takes the opposite of the front
longitudinal transfer; the **total** lateral transfer is split between axles in
proportion to static share ($d$ vs $1-d$) and each axle share moves entirely
from the inner to the outer wheel:

$$
F_{z,\text{front}} = m g d - \Delta F_{\text{long}},\qquad
F_{z,\text{rear}} = mg - F_{z,\text{front}}
$$

$$
F_{z,\text{outer}} = \frac{F_{z,\text{axle}}}{2} + \Delta F_{\text{lat}}\cdot s_{\text{axle}},
\qquad
F_{z,\text{inner}} = \frac{F_{z,\text{axle}}}{2} - \Delta F_{\text{lat}}\cdot s_{\text{axle}}
$$

Re-dividing the axle share by two would undercount the transfer by 50 % and
inflate cornering grip; the module deliberately does not.

### 10.2 Downforce

$$
F_{\text{down}}(v) = \tfrac{1}{2}\,\rho\,C_L\,A\,v_{\text{ms}}^2
$$

Added to the vertical loads, split front/rear by `downforceFrontShare`
(default = static weight distribution). Suspension compression per corner:
$\,\text{compression} = F_z / k_{\text{spring}}$ (mm).

### 10.3 Kamm friction circle

Longitudinal capacity from a tire already using $F_y$ of its $F_z$ budget:

$$
F_{x,\max} = \sqrt{(\mu F_z)^2 - F_y^2}
\quad\text{for } |F_y| < \mu F_z, \text{ else } 0
$$

The usable coefficient (v0.5.0) scales the road value by the tire-compound
grip gain from `tire-compounds.ts`:

$$
\mu = \mu_{\text{road}} \cdot g_{\text{compound}},\qquad
g \in \{0.92,\; 1.00,\; 1.08,\; 1.15,\; 1.22\}
$$

for Eco 400TW, Touring 300TW (neutral default), Sport 200TW, Semislick 100TW
and Slick. Unknown compound ids fall back to 1.0 (legacy-safe).

### 10.4 Differential limit

Total transmittable drive force by differential type:

| Type | Limit |
|:--|:--|
| open | $2 F_{x,\text{inner}}$ |
| clutch LSD | $F_{x,\text{inner}} + \min\!\big(F_{x,\text{outer}},\, F_{x,\text{inner}} + \beta(F_{x,\text{outer}}-F_{x,\text{inner}})\big)$ |
| Torsen | $F_{x,\text{inner}} \cdot (1 + 3.0)$ |
| spool | $F_{x,\text{inner}} + F_{x,\text{outer}}$ |

$\beta$ is the lock fraction (0–1). `drivenAxleLimitN` (internal) builds the
full chain: wheel loads → downforce → lateral force distributed to the driven
wheels proportional to $F_z$ → per-wheel Kamm limit → differential limit.
`maxDriveForceAtSpeed` exposes it as `{ limitN, perWheelN, isSpin }`;
`isSpin` is `engineForce > limitN`.

### 10.5 Wheelspin onset

`criticalWheelspinSpeed` scans each gear in 2 km/h steps from standstill to the
gear's redline speed, computing tractive force and the grip limit at each step.
The first speed where $F_x > F_{\text{limit}}$ is the per-gear spin onset
(display unit), else `null`.

### 10.6 Coast / engine braking

Closed throttle is modeled as 10 % of full-throttle torque:

$$
F_{\text{brake}}(n) = 0.10 \cdot F_x(n)
$$

`maxCoastForceAtSpeed` runs the same grip chain with the **coast-side** lock
(`differentialCoastBias`) and a negative longitudinal acceleration (load moves
forward), so a lightly loaded RWD inner wheel locks first — exactly what a high
coast-lock LSD should show. `criticalCoastLockupSpeed` scans each gear for the
first speed where the engine-braking demand exceeds the coast grip limit.

## 11. Rotating inertia — `inertia-math.ts`

Rotating driveline mass reflected through the engaged gear:

$$
m_{\text{eq}} = \frac{I_e \,(i_g i_d)^2 + N_w I_w}{r_{\text{dyn}}^2}
$$

where $I_e$ is crank/flywheel/clutch inertia, $I_w$ the per-wheel inertia and
$N_w$ the rotating wheel count (default 4). `launchRotatingMassKg` evaluates it
in first gear as the worst-case launch value.

## 12. Acceleration solver — `accel-math.ts`

Forward-Euler integration, fixed `dt = 0.01` s, strict SI:

$$
a_k = \frac{F_{\text{drive}} - F_{\text{load}}}{m + m_{\text{rot}}},
\qquad v_{k+1} = \max(0,\; v_k + a_k\,dt),
\qquad x_{k+1} = x_k + v_{k+1}\,dt
$$

- $F_{\text{load}} = F_{\text{drag}} + F_{\text{roll}} + F_{\text{grade}}$.
- $m_{\text{rot}}$ comes from `equivalentRotatingMassKg` when physical inertias
  are supplied (per-gear reflection), otherwise the static `rotatingMassKg`.
- Upshift RPM per gear = $\min(\text{redline},\, n_{\text{shift,opt}})$ from
  `optimalShiftFor`; top gear targets $+\infty$.
- During an upshift the drive force is cut for `shiftTimeS` (clamped to
  [0, 3] s); `launchRpm` holds engine speed during clutch slip and torque lookup
  is floored at `CURVE_MIN_RPM`.
- Drive force is clamped by `maxDriveForceAtSpeed` when a `runningGear` is set.
- 0–100 km/h and the 1/4 mile ($402.33928$ m) crossing times are interpolated
  within the step by linear fraction; trap speed is interpolated at the
  distance crossing.
- Intermediate splits (v0.5.0): 60 ft ($18.288$ m), 60 mph ($96.56064$ km/h)
  and 160 km/h crossing times via the same interpolation, plus an optional
  `reactionS` (clamped to [0, 5] s) added to every reported time without
  touching the physics; trap speed is reaction-free.
- Guards: 60 s time cap, 500 km/h divergence cap, null-result object on
  invalid inputs.

## 13. Cruise check — `cruise-math.ts`

Tallest gear whose RPM at the cruise speed stays $\ge$ `CRUISE_MIN_RPM = 1600`:

$$
n = \text{rpmFromKmh}(v_{\text{cruise}}, i_g, i_d, C_{\text{dyn}})
$$

Engine load:

$$
\text{load\%} = \frac{P_{\text{load}}(v_{\text{cruise}})}{P_{\text{engine}}(n)\cdot\eta}\cdot 100
$$

Verdict: `over` when $\text{load\%} > 100$, `high` when
$n > 0.85\,n_{\text{red}}$, else `ok`.

## 13bis. Braking and shift recovery — `brake-math.ts`, `recovery-math.ts` (v0.5.0)

### Ideal brake bias

Under deceleration $a_x = \text{decelG} \cdot g$ the load transfer
$\Delta F = m\,a_x\,h/L$ moves forward, so the ideal front bias equals the
dynamic front share:

$$
\beta_{\text{front}} = \frac{F_{z,\text{front}} + \Delta F}{F_{z,\text{front}} + F_{z,\text{rear}}},
\qquad F_{z,\text{rear,dyn}} = \max(0,\, F_{z,\text{rear}} - \Delta F)
$$

`idealBrakeBiasFront` returns the bias plus both dynamic loads and flags
`rearLockRisk` when the rear share drops below `REAR_LOCK_SHARE = 0.20`
(trail-braking instability); too far forward means early front lock and entry
understeer.

### Stopping distance

$$
d = \frac{v_{\text{ms}}^2}{2\,a},\qquad
a = \mu\,g + \frac{F_{\text{drag}} + F_{\text{grade}}}{m}
$$

Aero drag shortens the stop, downhill grade lengthens it; `stoppingDistanceM`
returns `Infinity` when the net deceleration is not positive.

### Gear-drop recovery time

After an upshift the engine lands at $n_{\text{land}}$ and must climb back to
$n_{\text{target}}$; with equivalent mass $m_{\text{eq}}$ and residual wheel
force $F$ held constant over the short window:

$$
t = \frac{\Delta v}{a},\qquad
a = \frac{F}{m_{\text{eq}}},\qquad
\Delta v = (n_{\text{target}} - n_{\text{land}}) \cdot \frac{C \cdot 60}{1000 \cdot i_g i_d} \cdot \frac{1}{3.6}
$$

`gearDropRecoveryMs` returns milliseconds (first-order estimate, no turbo
spool); 0 when already at target, `Infinity` with no residual force.

## 14. Units and axes — `unit-utils.ts`

- Speed grid step: 50 (km/h) / 25 (mph).
- RPM axis ceiling: $\lceil n_{\text{red}}/1000 \rceil \cdot 1000 + 500$.
- Power display: `toDisplayPower`/`fromDisplayPower` swap kW ⇄ cv via
  `KW_TO_HP`, with `formatPower` emitting one decimal place.
- Display preferences persisted in `haguruma-unit` / `haguruma-power-unit`.

## 15. Drivetrain efficiency — `drivetrain-eff.ts`

Default crank-to-wheel efficiency by driven layout (manual gearbox baseline):

| Layout | $\eta$ |
|:--|:--|
| FWD | 0.90 |
| RWD | 0.85 |
| AWD | 0.80 |

Unknown layouts fall back to RWD.

## 16. Module dependency graph

Import direction is strictly acyclic and one-way (a module only imports from
layers above it):

```
leaf modules (no math imports, only ../models):
  tire-math.ts   speed-math.ts   engine-curve-core.ts   inertia-math.ts   aero-math.ts
  recovery-math.ts

dyno-csv.ts      -> engine-curve-core.ts, aero-math.ts
traction-math.ts -> speed-math.ts, engine-curve-core.ts
shift-math.ts    -> speed-math.ts
dynamics-math.ts -> speed-math.ts, traction-math.ts, aero-math.ts, tire-compounds (grip gain)
cruise-math.ts   -> aero-math.ts, speed-math.ts, traction-math.ts
brake-math.ts    -> dynamics-math.ts (GRAVITY)

accel-math.ts    -> aero-math.ts, dynamics-math.ts, inertia-math.ts,
                    speed-math.ts, traction-math.ts
unit-utils.ts    -> aero-math.ts
drivetrain-eff.ts-> ../models only
```

No module imports `accel-math`, `cruise-math` or `dynamics-math` back; the
solver layer stays at the top of the graph.

`traction-math.ts` re-exports the whole `engine-curve-core.ts` surface, so
consumers can import curve symbols and force symbols from one entry point.

Call chain of one full render (per gear):

```
state -> validateCurve() -> tractiveForceAt() -> optimalShiftFor()
       -> criticalWheelspinSpeed() / criticalCoastLockupSpeed()
       -> roadLoadPowerKw() -> dragLimitedSpeedKmh()
       -> simulateAcceleration() (KPI strip, memoized)
```

## 17. Function index

| Module | Exports |
|:--|:--|
| `tire-math.ts` | `parseTire`, `clampRollingFactor`, `effectiveCircumferenceM`, `tireGrowthFactorAtSpeed`, `dynamicCircumferenceM`, `loadedDynamicRadiusM`, `ROLLING_FACTOR_DEFAULT/MIN/MAX`, `TIRE_GROWTH_REF_KMH/MAX`, `SIDEWALL_STIFFNESS_DEFAULT_NPM` |
| `speed-math.ts` | `speedKmh`, `rpmFromKmh`, `toDisplaySpeed`, `fromDisplaySpeed`, `calculateSpeed`, `calculateRpm`, `KMH_PER_MPH`, `MPH_PER_KMH` |
| `engine-curve-core.ts` | `validateCurve`, `enginePowerAt`, `engineTorqueAt`, `torqueAtRpm`, `anchorsFromPoints`, `sanitizeTorquePoints`, `torqueFromPower`, `powerFromTorque`, `clamp`, `KW_TO_NM`, `CURVE_MIN_RPM`, `POINTS_*` |
| `dyno-csv.ts` | `parseDynoCsv`, `smoothTorquePoints`, `smoothTorquePointsSG`, `smoothTorquePointsMedian`, `resampleTorquePoints`, `MAX_CURVE_POINTS` |
| `traction-math.ts` | `tractiveForceAt`, `dynamicRadiusM`, `optimalShiftFor`, `optimalShiftsForAll` (+ all `engine-curve-core` exports) |
| `shift-math.ts` | `describeUpshift`, `describeAllUpshifts`, `judgeShifts`, `speedForLandingRpm` |
| `aero-math.ts` | `dragForce`, `rollingForce`, `rollingForceAtSpeed`, `rollingCrrAtSpeed`, `gradeForce`, `roadLoadPowerKw`, `dragLimitedSpeedKmh`, `availableWheelKw`, `kwToHp`, `hpToKw`, `kmhToMs`, `clampGrade` |
| `dynamics-math.ts` | `staticAxleLoads`, `longitudinalTransfer`, `lateralTransfer`, `wheelLoads`, `drivenWheelsLoad`, `downforceN`, `compressionMm`, `kammLimit`, `diffLimit`, `maxDriveForceAtSpeed`, `maxCoastForceAtSpeed`, `engineBrakeForceAt`, `criticalWheelspinSpeed`, `criticalCoastLockupSpeed`, `GRAVITY`, `TORSEN_TBR`, `ENGINE_BRAKE_FRACTION` |
| `inertia-math.ts` | `equivalentRotatingMassKg`, `launchRotatingMassKg` |
| `brake-math.ts` | `idealBrakeBiasFront`, `stoppingDistanceM`, `REAR_LOCK_SHARE` |
| `recovery-math.ts` | `gearDropRecoveryMs` |
| `accel-math.ts` | `simulateAcceleration`, `QUARTER_MILE_M`, `SIXTY_FT_M`, `SIXTY_MPH_KMH` |
| `cruise-math.ts` | `cruiseCheck`, `CRUISE_MIN_RPM`, `CRUISE_HIGH_RPM_FRACTION` |
| `unit-utils.ts` | `getSpeedStep`, `getUnitLabel`, `getMaxRpm`, `formatPower`, `toDisplayPower`, `fromDisplayPower`, `initUnit`/`storeUnit`, `initPowerUnit`/`storePowerUnit` |
| `drivetrain-eff.ts` | `DEFAULT_DRIVETRAIN_EFF`, `efficiencyForLayout` |

Key interfaces: `EngineCurve`, `TorqueCurvePoint` (`models.ts`),
`OptimalShift`, `ShiftStep`, `ShiftVerdict`, `SimInput`, `SimResult`,
`CruiseInput`, `CruiseResult`, `RunningGear`, `PlotFrame`.

## 18. Input ranges and guards

Clamps and validation bounds that silently rescue bad input:

| Quantity | Accepted range | Enforced by |
|:--|:--|:--|
| Gear ratio | [0.4, 6.0] | `shift-math.isValidRatio`, `GRAPH_LIMITS` |
| Rev limiter | [3000, 12000] rpm | `validateCurve` |
| Torque peak RPM | [`CURVE_MIN_RPM`, power peak RPM] | `validateCurve` |
| Power peak RPM | [`CURVE_MIN_RPM`, redline] | `validateCurve` |
| Dyno point RPM | [500, 15000] | `sanitizeTorquePoints` |
| Dyno point torque | [5, 5000] Nm | `sanitizeTorquePoints` |
| Rolling factor $f$ | [0.9, 1.0] | `clampRollingFactor` |
| Road grade | [−30, +30] % | `clampGrade` |
| Drivetrain efficiency | [0, 1] | `tractiveForceAt`, `availableWheelKw` |
| Shift torque cut | [0, 3] s | `simulateAcceleration` |
| Wheel count | integer ≥ 0 (default 4) | `equivalentRotatingMassKg` |
| wheel-load ranges | see `RunningGear` docs in `models.ts` | catalog validator + UI |

Every other function returns `0`, `null` or a null-result object rather than
`NaN`/`Infinity`; guards are listed per function in the TSDoc.

## 19. Unit conversions quick reference

| From → To | Factor / formula |
|:--|:--|
| km/h → m/s | $/3.6$ (`kmhToMs`) |
| km/h → mph | `× MPH_PER_KMH` = $/1.609344$ |
| mph → km/h | `× KMH_PER_MPH` = $× 1.609344$ |
| kW → Nm at $n$ | $× KW\_TO\_NM / n$, $KW\_TO\_NM = 30000/\pi$ |
| Nm → kW at $n$ | $× n / KW\_TO\_NM$ |
| kW → cv (metric hp) | $× 1.35962$ |
| cv → kW | $/ 1.35962$ |
| kgm → Nm | $× 9.80665$ |
| mm → m | $/ 1000$ |
| revolutions/min → rad/s | $× 2\pi/60$ (not used; model stays in rev/min) |

## 20. Worked example

Fixture (matches `tests/traction-math.test.ts`): redline 7200 rpm, peak torque
180 Nm @ 4500 rpm, peak power 110 kW @ 6500 rpm, gears 3.58 / 2.05 / 1.38 / 1.00,
fd 4.10, `circM` 1.935 m, $\eta$ 0.85. Road: mass 1200 kg, $C_d A$ 0.65 m²,
$C_{rr,0}$ 0.013, flat.

1. **Dynamic radius.** $r_{\text{dyn}} = 1.935/(2\pi) = 0.30796$ m.
2. **1st-gear force at the torque peak.** $T(4500) = 180$ Nm (anchor peak), so
   $F_x = 180 · 3.58 · 4.10 · 0.85 / 0.30796 \approx 7292$ N.
3. **Speed at 4500 rpm in 1st.**
   $v = \dfrac{4500}{3.58 · 4.10} · 1.935 · \dfrac{60}{1000} \approx 35.59$ km/h.
4. **Landing RPM in 2nd.** $n_{\text{land}} = 4500 · 2.05/3.58 \approx 2577$ rpm.
5. **Torque at 2577 rpm (anchor ramp).**
   $k = (2577-1000)/(4500-1000) = 0.451$, so
   $T = 180 (0.5 + 0.5·0.451) \approx 130.5$ Nm.
6. **2nd-gear force at that speed.**
   $F_x = 130.5 · 2.05 · 4.10 · 0.85 / 0.30796 \approx 3028$ N.
7. **Shift decision.** $\Delta F = 3028 - 7292 \approx -4264$ N $< 0$: staying in
   1st wins at this speed, so the crossing lies higher and `optimalShiftFor`
   keeps scanning toward redline.
8. **Road load at 35.59 km/h.** $v_{ms} = 9.889$ m/s;
   $F_{\text{drag}} = 0.5 · 1.225 · 0.65 · 9.889^2 \approx 38.9$ N;
   $C_{rr}(v) = 0.013(1 + 35.59/160) = 0.015892$,
   $F_{\text{roll}} = 1200 · 9.81 · 0.015892 \approx 187.1$ N; total ≈ 226 N.
   Net wheel force ≈ 7292 − 226 = **7066 N**.

Numbers are rounded for readability; `tests/` assert the same relations with
`toBeCloseTo`.

## 21. Assumptions and limitations

Deliberately **not** modeled — useful to know before trusting a number:

- **Tire grip:** one $\mu$ per setup with a Kamm circle. No slip curve /
  Pacejka, no load sensitivity of $\mu$, no pressure, temperature, wear or
  relaxation length, so grip is symmetric and rate-independent.
- **Tire geometry:** centrifugal growth is speed-only (quadratic, capped +3 %);
  load squash is the fixed `rollingFactor`, not a function of vertical load.
- **Load transfer:** quasi-static. No suspension compliance, roll stiffness,
  anti-dive/squat, ride-height or transient (damped) transfer. Wheel loads are
  clamped at 0, so wheel lift is treated as zero load, not a lift event.
- **Lateral:** `lateralG` is a user input, not solved from a corner or steering
  geometry.
- **Aero:** steady-state $C_L A$ and $C_d A$; no pitch/rake or ground-effect
  variation, no wind (air speed equals ground speed).
- **Differential:** static bias model. No preload torque, ramp angles, viscous
  coupling or temperature hysteresis; Torsen transfer bias is fixed at 3.0.
- **Engine:** quasi-static torque curve. No turbo spool dynamics, intake
  transients, thermal derate or rev-limiter bounce; beyond redline the anchor
  model returns 0 power, dyno points return 0.
- **Driveline:** shifts are a torque cut for `shiftTimeS`; the only other inertia
  effect is the reflected equivalent mass. No clutch slip model beyond the
  `launchRpm` hold, no driveshaft wind-up.
- **Rolling resistance:** grows linearly with speed above the base $C_{rr,0}$;
  no temperature or belt/compound effects.
- **Road:** constant grade; no curvature, banking or surface change over
  distance.

## 22. Validation anchors

Cross-checks that pin the model to reality:

| Anchor | Expected | Basis |
|:--|:--|:--|
| `205/55R16` geometry | Ø 631.9 mm, $C_{\text{geo}}$ 1.9852 m, $r_{\text{dyn}}$ ≈ 0.3080 m | parse + 0.975 factor |
| `195/60R15` geometry | Ø 615 mm, circumference 1.9321 m | parse |
| Eclipse 1G reverse top speed | ≈ 61 km/h | 7000 rpm, $i$ 3.083, $i_d$ 4.322 |
| Eclipse 1G 5th-gear Vmax | 215–220 km/h @ ≈ 5900–6100 rpm | drag-limited, README anchor |
| Tire growth at 250 km/h | exactly ×1.03 | `tireGrowthFactorAtSpeed` cap |
| Loaded radius at 3433 N | $r \cdot 2\pi \approx 0.976\,C_{\text{geo}}$ | default 450000 N/m stiffness |
| 100-0 km/h stop on μ 1.0 | ≈ 39.3 m | $v^2/2a$ anchor |
| Torque peak on the anchor ramp | ≥ 50 % of peak at 1000 rpm, 100 % at `peakTorqueRpm` | piecewise model |
| Dyno tail at redline | 90 % of last measured power | `POINT_TAIL_TAPER` |

## 23. Graph coordinate mapping

The plot is not physics, but it lives in the same units. Since v0.6.0 the
graph is a declarative SVG: every render pins the viewBox of `#graph-svg` to
the measured host size in CSS pixels (`graph-renderer.ts`), so one user unit
equals one screen pixel, fonts keep their real size on every viewport and
the plot never stretches. Mapping in `svg-frame.ts` (user units):

$$
x(v) = \text{pad}_{\text{left}} + \frac{v}{v_{\max}}\,\text{plotWidth},
\qquad
y(n) = \text{pad}_{\text{top}} + \text{plotHeight} - \frac{n}{n_{\max}}\,\text{plotHeight}
$$

$$
\text{plotWidth} = W - \text{pad}_{\text{left}} - \text{pad}_{\text{right}},
\qquad
\text{plotHeight} = H - \text{pad}_{\text{top}} - \text{pad}_{\text{bottom}}
$$

Base paddings (top/right/bottom/left) = 34/74/48/62 user units, scaled by
$\max(0.62, \min(1, W/900))$ so narrow hosts keep a readable plot band.
Axis ceiling $n_{\max} = \lceil n_{\text{red}}/1000 \rceil · 1000 + 500$;
$v_{\max}$ is the state's `maxGraphSpeed`. Gear rays are cut at the
drag-limited wall: solid up to the wall, dashed (`10 8`, opacity 0.32)
past it; the required-power envelope crossing lands on the same wall
speed, so the power label and the wall label can never disagree.

Ghost-delta readout (v0.5.0, `describeAllShiftDeltas` in `shift-math.ts`,
rendered as DOM rows in `#comp-shift-deltas`): at each primary up-shift
point, $\Delta n$ compares the next-gear landing RPM of both setups at the
same road speed and $\Delta v$ compares the same-gear shift-point speeds; the
plot stays curve-only.

## 24. Extending the model

When adding physics:

1. Put pure math in a new `src/core/math/<name>-math.ts` (`@file` + `@brief`).
2. Validate inputs and return a neutral value on bad data; never throw.
3. Keep SI inside and convert units only at the boundary.
4. Add a TSDoc block (`@brief`, `@param`, `@return`) to every function.
5. Export constants with the formulas that use them; do not duplicate units.
6. Add a mirror suite in `tests/<name>-math.test.ts`, plus a README / AGENTS.md row.
7. Keep the file under 400 lines and functions under 50 lines.

## 25. Test coverage map

| Suite | Covers |
|:--|:--|
| `tests/tire-math.test.ts` | parsing, rolling factor, centrifugal growth, load-sensitive radius |
| `tests/tire-compounds.test.ts` | compound catalog order, gains, i18n labels, legacy fallback |
| `tests/speed-math.test.ts` | SI conversions, mph boundary |
| `tests/aero-math.test.ts` | drag, speed-sensitive rolling, grade, top-speed bisection |
| `tests/traction-math.test.ts` | tractive force, optimal shift, curve model |
| `tests/engine-curve-akima.test.ts` | Akima interpolation, node exactness |
| `tests/dyno-csv.test.ts` | delimiters, units, smoothing (gauss/SG/median), resampling |
| `tests/shift-drops.test.ts` | landing RPM, drops, verdicts, shift-point deltas |
| `tests/dynamics-math.test.ts` | load transfer, friction circle, dyno taper, coast lock |
| `tests/inertia-math.test.ts` | equivalent rotating mass |
| `tests/brake-math.test.ts` | bias transfer, rear-lock flag, stopping distance |
| `tests/recovery-math.test.ts` | recovery time monotonicity and guards |
| `tests/accel-math.test.ts` | 0–100 / 1/4 mile solver, splits, reaction offset |
| `tests/cruise-math.test.ts` | gear pick, load, verdict |
| `tests/drivetrain-eff.test.ts` | layout efficiency map |
| `tests/unit-utils.test.ts` | axes, unit persistence, power formatting |

Run them with `npm test` (or `npx vitest run tests/<file>.test.ts`).
