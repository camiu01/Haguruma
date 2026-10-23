# MATH

Physics and unit model behind HAGURUMA. Every relation below is implemented in
`src/core/math/` (plus `src/core/units/unit-utils.ts`,
`src/config/drivetrain-eff.ts` and the tire-compound grip gains in
`src/config/tire-compounds.ts`) and mirrored by the test suites in `tests/`.

Two functions in `tire-math.ts` — `loadedDynamicRadiusM` and
`dynamicCircumferenceM` — are documented here because they are exported and
unit-tested, but **no runtime path calls them**; §3.3 and §3.4 say so explicitly
and §29 repeats it. Everything else in this document describes code that runs.

§33 lists what the test suites pin and, just as importantly, what they do not:
there is no measured-vehicle validation anywhere in the project, and §30's
anchors are expectations and derivations rather than recorded measurements.

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
| $\eta$ | drivetrain efficiency: constant fallback or measured-map value | [0, 1] |
| $\mu$ | road friction coefficient | – |
| $F_z$ | vertical wheel load | N |
| $C_{rr}$ | rolling-resistance coefficient | – |
| $C_L$ | lift (downforce) coefficient | – |
| $A$ | frontal / reference area | m² |
| $T$ | engine torque | Nm |
| $P$ | engine power | kW |
| $m$ | vehicle mass (curb) | kg |
| $a_x$ | longitudinal acceleration (positive = accelerating) | m/s² |
| $\beta$ | differential lock fraction | [0, 1] |
| $g_c$ | tire-compound grip gain | – |

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
| `MIN_RATIO` / `MAX_RATIO` | 0.4 / 6.0 | `shift-math.ts` |
| `REAR_LOCK_SHARE` | 0.20 | `brake-math.ts` |
| `EFFICIENCY_MAP_MIN/MAX_SAMPLES` | 2 / 256 | `efficiency-map.ts` |
| `EFFICIENCY_MAP_RPM_MIN/MAX` | 500 / 15000 | `efficiency-map.ts` |
| `EFFICIENCY_CSV_MAX_CHARS` | 50 000 | `efficiency-map.ts` |
| `LIMITER_OVERSPEED_RPM` | 150 | `powertrain-math.ts` |
| `LIMITER_BOUNCE_PERIOD_S` / `ON_WINDOW_S` | 0.1 / 0.05 | `powertrain-math.ts` |
| `BRAKE_STEP_S` / `BRAKE_MAX_STEPS` | 0.01 s / 12 000 | `braking-simulation.ts` |
| `ABS_CYCLE_S` / `ABS_REDUCED_WINDOW_S` | 0.08 / 0.02 | `braking-simulation.ts` |
| `ABS_REDUCED_FACTOR` / `LOCKED_TIRE_FACTOR` | 0.9 / 0.75 | `braking-simulation.ts` |
| `LAP_STEP_S` / `LAP_SAMPLE_EVERY` | 0.01 s / 10 steps (100 ms) | `lap-sequence.ts` |
| `LAP_MAX_CHARS` / `LAP_MAX_ROWS` / `LAP_MAX_TOTAL_S` | 8000 / 60 / 180 s | `lap-sequence.ts` |
| `LAP_COMMAND_MIN/MAX_S` / `MAX_GEAR` | 0.01 / 60 s / 8 | `lap-sequence.ts` |
| `CLUTCH_ENGAGE_S` | 0.2 s | `lap-sequence.ts` |
| `TELEMETRY_MAX_CHARS` | 10 000 000 | `telemetry-math.ts` |
| `TELEMETRY_RPM_MIN/MAX` | 0 / 30000 | `telemetry-math.ts` |
| `TELEMETRY_SPEED_MAX_KMH` | 600 | `telemetry-math.ts` |
| `RATIO_CLUSTER_TOLERANCE` / `RATIO_SLIP_TOLERANCE` | 0.06 / 0.03 | `telemetry-math.ts` |
| `GPX_MAX_CHARS` / `GPX_MAX_POINTS` | 5 000 000 / 50 000 | `gpx-track.ts` |
| `GPX_EARTH_RADIUS_M` | 6 371 000 | `gpx-track.ts` |
| `STRAIGHT_TURN_TOLERANCE` | $\pi/36$ (5°) | `gpx-track.ts` |
| `GEARSET_SPACINGS` | 0.62 … 0.86 (7 values) | `gear-optimizer.ts` |
| `GEARSET_MAX_CANDIDATES` / `MAX_FINAL_DRIVES` | 1000 / 100 | `gear-optimizer.ts` |
| `GEARSET_RATIO_MIN/MAX` | 0.3 / 8.0 | `gear-optimizer.ts` |
| `PERF_SESSION_MAX_S` | 120 s | `performance-session.ts` |
| `PERF_ACCURACY_MAX_M` | 15 m | `performance-session.ts` |
| `PERF_SAMPLE_GAP_MAX_S` | 2 s | `performance-session.ts` |
| `PERF_QUARTER_MILE_M` | 402.336 | `performance-session.ts` |
| `SENSITIVITY_STEP` | +5 % per input | `setup-sensitivity.ts` |

Rows whose constant name is not backticked are internal literals of that file
(the numbers still bound behaviour exactly as stated); named constants are
exported and can be imported by callers.

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

Quadratic in speed, capped at +3 % near 250 km/h.

**Not applied in the current path.** `tireGrowthFactorAtSpeed` and
`dynamicCircumferenceM` are exported and unit-tested, but no module outside
`tire-math.ts` calls them: every runtime caller
(`components/gear-table.ts`, `services/graph/*`, the solvers) builds its
circumference with `effectiveCircumferenceM(tire, state.rollingFactor)` and
passes that static value to `dynamicRadiusM`. The radius actually used is
therefore

$$
r_{\text{dyn}} = \frac{C_{\text{eff}}}{2\pi}
\qquad(\text{dynamicRadiusM in traction-math.ts, no speed term})
$$

so the +3 % high-speed growth is a dormant correction, not part of any computed
number in the shipped path.

### 3.4 Load-sensitive radius (implemented, not wired into the model)

`loadedDynamicRadiusM` is implemented and exported, but it is **not referenced
anywhere in `src/` outside its own definition**; its only consumer is
`tests/tire-math.test.ts`. The traction and dynamics paths use
`dynamicRadiusM(C_eff)` from `traction-math.ts`, which divides the effective
circumference of §3.2 by $2\pi$ and applies **no vertical-load term**. The
formula below is a dormant alternative, kept for reference and pinned only in
isolation by that one suite:

$$
r(v, F) = \max\!\left(\frac{r_{\text{geo}}}{2},\; r_{\text{geo}} - \frac{F}{k}\right) \cdot k_g(v),
\qquad r_{\text{geo}} = \frac{C_{\text{geo}}}{2\pi}
$$

with default $k = 450000$ N/m (`SIDEWALL_STIFFNESS_DEFAULT_NPM`), which
reproduces the 0.975 ISO factor at typical corner loads ($\approx$ 3433 N per
tire on a 1400 kg car); the half-radius floor reads extreme overload as a flat
tire instead of `NaN`. Because no caller supplies a vertical load, the load
sensitivity described in earlier revisions of this document affects no computed
number — see §29.

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

Both forces in $\Delta F$ are evaluated through the same $\eta$ path: the
constant `drivetrainEff` unless a measured efficiency map is present, in which
case `mappedEfficiency` is queried at **full load** (`load = 1`) for the current
and landing RPM (§15). Samples whose landing RPM falls below
`CURVE_MIN_RPM = 1000` are dropped from the scan, so the crossing search never
compares a next-gear point that the curve model cannot represent.

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

**Breakaway preload.** For a clutch LSD a constant breakaway torque adds a
wheel-force term, and the sum is still bounded by the two wheels' combined
capacity:

$$
F_{\text{limit}} = \max\!\Big(0,\; \min\big(F_{x,\text{inner}} + F_{x,\text{outer}},\;
\operatorname{diffLimit}(\text{type}, \beta, F_{x,\text{inner}}, F_{x,\text{outer}})
+ \frac{T_{\text{preload}}}{\max(0.1,\; r_{\text{preload}})}\big)\Big)
$$

$T_{\text{preload}}$ = `differentialPreloadNm` (clamped to [0, 1000] Nm) and
$r_{\text{preload}}$ = `preloadRadiusM` (floored at 0.1 m; the UI stores the
tire's rolling radius there). Only the `clutch_lsd` type gets the term — Torsen,
open and spool models ignore it.

**AWD centre split.** When the layout is AWD and the setup carries a centre
setting, `drivenAxleLimitN` recurses into the FWD and RWD limits and combines
them instead of using a single driven pair:

| Centre setting | Combined limit |
|:--|:--|
| `centerDisengaged` (free coupling, e.g. a handbrake phase) | the FWD limit alone |
| `activeCenter` (capacity-based control) | FWD limit + RWD limit |
| fixed `awdFrontShare` $s$ | $\min\!\big(F_{\text{front}}/s,\; F_{\text{rear}}/(1-s)\big)$, with $s \le 0$ → RWD only and $s \ge 1$ → FWD only |

Without any of the three fields an AWD car uses the four-wheel driven pair with
the full lateral demand, i.e. the split is not modelled.

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

- $F_{\text{load}} = F_{\text{drag}} + F_{\text{roll}} + F_{\text{grade}}
  + F_{\text{handbrake}}$; the handbrake term is `handbrakeForceAtSpeed`
  evaluated with the previous step's acceleration, so a non-zero
  `handbrakeFraction` retards an acceleration run too.
- $m_{\text{rot}}$ comes from `equivalentRotatingMassKg` when physical inertias
  are supplied (per-gear reflection), otherwise the static `rotatingMassKg`.
- $\eta$ in the wheel-force term is the constant `drivetrainEff` unless a
  measured map is present, in which case `mappedEfficiency` is queried at the
  torque-lookup RPM and **full load** (`load = 1`).
- Upshift RPM per gear = $\min(\text{redline},\, n_{\text{shift,opt}})$ from
  `optimalShiftFor`; top gear targets $+\infty$.
- During an upshift the drive force is cut for the per-upshift
  `shiftTimesS[gear]` when supplied, else `shiftTimeS` (each clamped to
  [0, 3] s); `launchRpm` holds engine speed during clutch slip and torque lookup
  is floored at `CURVE_MIN_RPM`.
- Drive force is multiplied by `limiterTorqueFactor` (0 at or above the
  limiter, §15) and clamped by `maxDriveForceAtSpeed` when a `runningGear` is
  set.
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

## 14. Braking, handbrake and shift recovery — `brake-math.ts`, `braking-simulation.ts`, `handbrake-math.ts`, `recovery-math.ts`

`brake-math.ts` is the closed-form layer (ideal bias, one-shot stopping
distance); `braking-simulation.ts` is the time-stepped layer that adds load
transfer, wheel-lock limits, aero and grade; `handbrake-math.ts` folds the rear
handbrake and engine braking into the same tire budgets. Both layers use the
same $\mu$ chain (road $\times$ compound gain, §10.3) and the same per-axle
Kamm capacities, so the closed-form distance and the integrated profile agree in
the limit the closed form assumes: constant $\mu$, no lateral demand and no
downforce. They deliberately disagree once $|\text{lateralG}| > 0$ or the
downforce term is significant, because only the integrated layer reallocates the
per-axle budgets.

### Ideal brake bias — `brake-math.ts`

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

### Closed-form stopping distance — `brake-math.ts`

$$
d = \frac{v_{\text{ms}}^2}{2\,a},\qquad
a = \mu\,g + \frac{F_{\text{drag}} + F_{\text{grade}}}{m}
$$

Aero drag shortens the stop, downhill grade lengthens it; `stoppingDistanceM`
returns `Infinity` when the net deceleration is not positive.

### Gear-drop recovery time — `recovery-math.ts`

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

### Integrated braking profile — `braking-simulation.ts`

**Purpose and scope.** Turn a brake setup into a stopping distance, a time and a
sampled speed profile, with the load transfer and the per-axle friction budget
solved at every step instead of assumed constant. It also exposes the per-step
axle force resolver that the lap sequence reuses.

**Inputs and outputs.**

| Field | Meaning | Unit |
|:--|:--|:--|
| `speedKmh` | initial road speed | km/h |
| `massKg` | vehicle mass | kg |
| `runningGear` | chassis/grip setup (`μ`, compound, loads, downforce, `lateralG`) | – |
| `frontBias` | front share of the pedal demand | [0, 1] |
| `abs` | approximate ABS on/off | – |
| `dragCd`, `areaM2` | drag term | –, m² |
| `gradePercent` | road slope, positive uphill | % |

`simulateBraking` returns `{ distanceM, timeS, frontLock, rearLock, points }`;
`distanceM`/`timeS` stay `null` when the run is invalid or the net deceleration
never becomes positive. Each point is
`{ timeS, distanceM, speedKmh, decelMps2 }`, sampled every 10 steps (100 ms) plus
the exact stop.

**Per-step axle forces** (`brakingTireForce`, `fraction` = pedal demand):

$$
\mu = \mu_{\text{road}}\,g_c,\qquad
F_{z,\text{axle}} = \text{axle load}(a_x = -\text{decel}) + F_{\text{down}} \cdot s_{\text{axle}}
$$

$$
C_{\text{front}} = \operatorname{kamm}\!\big(\mu,\; F_{z,\text{front}},\;
F_{\text{lat}} \cdot d\big),\qquad
C_{\text{rear}} = \operatorname{kamm}\!\big(\mu,\; F_{z,\text{rear}},\;
F_{\text{lat}} \cdot (1-d)\big)
$$

$$
D = \mu\,(m g + F_{\text{down}}) \cdot \operatorname{clamp}(\text{fraction}, 0, 1),
\qquad D_{\text{front}} = D\,b,\quad D_{\text{rear}} = D\,(1-b)
$$

$$
F_{\text{axle}} =
\begin{cases}
D_{\text{axle}}, & D_{\text{axle}} \le C_{\text{axle}}\\[2pt]
C_{\text{axle}} \cdot \alpha, & D_{\text{axle}} > C_{\text{axle}}
\end{cases}
\qquad
\alpha =
\begin{cases}
0.9, & \text{ABS on, inside the 20 ms reduced window of an 80 ms cycle}\\
1, & \text{ABS on, outside that window}\\
0.75, & \text{ABS off (locked tire)}
\end{cases}
$$

$F_{\text{lat}} = m g\,|\text{lateralG}|$ is the lateral demand held constant for
the whole stop, $d$ is `frontWeightDistribution` and $b$ is `frontBias`.
`frontLock`/`rearLock` are set when ABS is off and the axle demand exceeds its
capacity by more than 1 N; they latch across the run.

**Integration.** Forward difference at `dt = min(0.01 s, v/decel)` — the last
step lands exactly on $v = 0$:

$$
F = F_{\text{front}} + F_{\text{rear}} + F_{\text{drag}}(v) + F_{\text{grade}},
\qquad a = F/m,\qquad
d_{k+1} = d_k + \tfrac{v_k + v_{k+1}}{2}\,dt
$$

`decel` is seeded with $\mu g$ before the first step and then reused as the
"previous deceleration" that drives the load transfer
($a_x = -\text{decel}$) and the ABS cycle clock (`timeS = step \cdot 0.01`).
The loop stops at $v = 0$, after 12 000 steps (120 s) or as soon as the net
deceleration is not finite and positive (in which case the metrics stay `null`
while the partial `points` array is returned).

**Assumptions and simplifications.** ABS is a periodic 10 % demand trim, not a
slip controller; a locked non-ABS tire is credited with 0.75 × its capacity;
$\mu$ is constant and speed-independent with no slip curve; the lateral demand
is a user input and the lateral/vertical split uses the static weight
distribution while the vertical split uses `downforceFrontShare`; the coast-side
differential lock and the handbrake are not part of this path; grade and drag
are evaluated at the current speed only; the load transfer is quasi-static, so
the pitch transient of a real stop is absent.

**Shared with the lap sequence.** `brakingTireForce` is the service-brake
resolver of `lap-sequence.ts` (§16), called with the pedal fraction of the
active command, so the two solvers cannot drift apart. It is *not* used by
`brake-math.ts`, which stays closed-form.

**Known limitations and evidence.** No measured stop is shipped, so the profile
is an implementation check only: `tests/release-physics.test.ts` pins
monotonic speed decrease, a 20–80 m band for a 100 km/h stop, a longer wet stop,
rear-lock flagging without ABS at an extreme rear bias, a null result on invalid
mass, and the reference-profile start/end points.

### Handbrake and combined axle budgets — `handbrake-math.ts`

**Rear handbrake force.** `handbrakeForceAtSpeed(rg, m, v, a_x)` reuses the rear
axle's Kamm budget at the live load, then scales it by the demanded fraction:

$$
F_{\text{hb}} = f_{\text{hb}} \cdot
\operatorname{kamm}\!\big(\mu,\; F_{z,\text{rear}} + F_{\text{down}}(1-s),\;
m g\,|\text{lateralG}|\,(1-d)\big),
\qquad f_{\text{hb}} = \min(1, \text{handbrakeFraction})
$$

The signed $a_x$ comes from the caller, so a forward load transfer (braking or a
coasting deceleration) unloads the rear axle and reduces the available handbrake
force — the same mechanism the coast-lock scan uses (§10.6). The result is
clamped to $\ge 0$; a missing setup, a non-finite fraction or a fraction $\le 0$
returns 0. The downforce term uses `liftReferenceAreaM2 ?? 0`, so a setup that
sets only `liftCoefficient` gets no handbrake downforce. `drivenAxleLimitN`
(the drive and coast path) uses the same `?? 0` convention, but
`braking-simulation.ts` falls back to the drag area (`input.areaM2`) for the same
term. The brake path is therefore the outlier: on a setup whose running gear
leaves `liftReferenceAreaM2` empty, service braking sees downforce while the
handbrake and the traction limit do not. The shipped default sets the field to
2.0 m², so the discrepancy only appears on hand-built or legacy-decoded setups;
it is recorded here rather than silently smoothed over.

**One tire budget per axle** (`combinedAxleBraking`). Service, handbrake and
engine/clutch braking are resolved against the capacities that
`brakingTireForce` already computed, never against a second full budget:

$$
F_{\text{rear}} = \min\!\big(C_{\text{rear}},\, F_{\text{rear,service}} + F_{\text{hb}}\big)
$$

$$
R_{\text{front}} = \max(0, C_{\text{front}} - F_{\text{front,service}}),\qquad
R_{\text{rear}} = \max(0, C_{\text{rear}} - F_{\text{rear}})
$$

$$
F_{\text{coast}} = \max(0, \min(D_{\text{coast}}, L_{\text{coast}})),\qquad
F_{\text{extra}} = \min(R_{\text{front}}, F_{\text{coast}}\,s)
                + \min(R_{\text{rear}}, F_{\text{coast}}(1-s))
$$

with the coast share $s$ chosen by layout:

| Layout / centre | $s$ |
|:--|:--|
| FWD, or AWD with `centerDisengaged` | 1 (all engine braking to the front) |
| RWD | 0 |
| AWD with `activeCenter` | $R_{\text{front}}/(R_{\text{front}}+R_{\text{rear}})$ (capacity-based) |
| AWD, fixed coupling | `awdFrontShare ?? frontWeightDistribution` |

$$
F_{\text{total}} = F_{\text{front,service}} + F_{\text{rear}} + F_{\text{extra}}
$$

`lockRisk` is `true` when the rear demand (`F_rear,service + F_hb`) exceeds
`rearCapacityN` by more than 1 N, or when the coast demand is larger than the
capacity that could be absorbed. "Lock risk" here means *the axle's friction
budget was exceeded in this step*, i.e. the tire is at its Kamm limit; the model
does not compute slip, so it is a demand-versus-budget flag, not a predicted
lockup event.

**Known limitations and evidence.** No preload, ramp rate or plate temperature is
applied to the service brakes; the handbrake is a pure rear force with no
cable/drum geometry; the lateral demand is a user input. Evidence is internal
only: `tests/release-physics.test.ts` asserts that a rear handbrake force is
produced, that a forward transfer reduces it, that a zero fraction yields zero,
and that unused front capacity cannot be borrowed to over-brake the rear axle
(one test pins `forceN = 7000` and `lockRisk = true` for a synthetic case).

## 15. Powertrain efficiency map and rev limiter — `powertrain-math.ts`, `efficiency-map.ts`

### 15.1 Purpose and scope

An optional, user-imported map of drivetrain efficiency against engine speed and
normalized load, plus the rev-limiter torque gate. **No factory calibration ships
with the project**: with no map loaded every solver uses the constant
`drivetrainEff` of §23 and both map functions degenerate to that constant.

### 15.2 Mapped efficiency (`mappedEfficiency`)

Inputs: `samples` (`EfficiencySample[]`, absent or empty allowed), `rpm`, `load`,
`fallback`. Output: an efficiency in $(0, 1]$.

1. No samples → $\operatorname{clamp}(\text{fallback}, 0, 1)$, with a non-finite
   fallback read as 0.
2. Each sample is filtered individually: finite `rpm`/`load`/`efficiency`,
   $n_i \ge 0$, $\ell_i \in [0,1]$, $\eta_i \in (0,1]$. Invalid rows are skipped,
   not fatal.
3. An exact hit (weighted distance $< 10^{-12}$) returns that sample verbatim.
4. Otherwise inverse-distance weighting over the surviving samples:

$$
d_i = \left(\frac{n_i - n}{1000}\right)^2 + \big(4(\ell_i - \ell)\big)^2,
\qquad
w_i = \frac{1}{d_i},
\qquad
\eta = \frac{\sum_i w_i \eta_i}{\sum_i w_i}
$$

The RPM axis is divided by 1000 and the load axis multiplied by 4, so a 1000 rpm
offset and a 0.25 load offset weigh the same, while a 250 rpm offset weighs
1/16 of either. That anisotropy is a fixed documented choice, not a fitted
kernel. If no weight survives, the fallback is returned.

### 15.3 Rev-limiter gate (`limiterTorqueFactor`)

| Condition | Multiplier |
|:--|:--|
| $n < n_{\text{red}}$ | 1 |
| mode `hard`, or $n \ge n_{\text{red}} + 150$ | 0 |
| mode `bounce` and $n < n_{\text{red}} + 150$ | 0 while $t \bmod 0.1 < 0.05$, else 1 |

The bounce mode is a square-wave cut at 10 Hz inside a 150-rpm overspeed window;
beyond that window it becomes a hard cut, so no input can hold power above
$n_{\text{red}} + 150$.

### 15.4 Where the map is used

| Consumer | Query | Effect |
|:--|:--|:--|
| `accel-math.ts: simulateAcceleration` | `(map, torqueLookupRpm, 1, drivetrainEff)` each step | scales the wheel force, so a less efficient map slows 0–100 |
| `traction-math.ts: optimalShiftFor` / `optimalShiftsForAll` | load 1 at the current **and** landing RPM | shift targets and shift speeds |
| `accel-math.ts: buildShiftTargets` | via `optimalShiftFor` | per-gear upshift RPM inside the solver |
| `gear-table.ts`, `traction-margin.ts`, `force-graph.ts` | load 1 at the plotted/tabulated RPM | table and graph force readouts |
| `setup-sensitivity.ts: evaluate` | passed to `optimalShiftFor` only | shift-target sensitivity; the top-speed metric keeps the constant $\eta$ (see §20) |

### 15.5 Import and validation (`parseEfficiencyCsv`, `validateEfficiencyMap`)

| Rule | Bound |
|:--|:--|
| File size | $\le 50\,000$ characters (the Tools panel also refuses a file above 50 kB) |
| Header | first non-empty line must read exactly `rpm,load,efficiency` (cells lowercased and trimmed) |
| Separator | `;` if present in the header, else tab, else `,` |
| Columns | exactly 3, no empty cell |
| Values | numeric, decimal comma accepted per cell; **fractions**, so `60` is rejected |
| Sample count | 2 … 256 |
| RPM | [500, 15000] |
| Load | [0, 1] |
| Efficiency | $(0, 1]$ |
| Uniqueness | `(rpm, load)` pairs must be unique |

Rejection is atomic: one bad row voids the whole file and the function returns
`null`, leaving the previously applied map (or the constant) untouched. There is
no ordering requirement, no minimum spread across RPM or load, and no
interpolation-quality check, so a two-point map at a single RPM is accepted.

### 15.6 Assumptions and limitations

- The model is **not** calibrated out of the box; an absent map means the layout
  default is the whole model.
- Inverse-distance weighting is exact at nodes but smears between them; it can
  create a plateau or a dip that the measurement does not contain. There is no
  spline, kriging or uncertainty estimate.
- The map has two axes only (RPM × load): no temperature, gear, oil or
  accessory-load dependence.
- The load axis is the commanded throttle fraction in the lap solver (§16) and a
  hard-coded 1 everywhere else, not a torque ratio derived from the current
  operating point, so part-throttle operation outside the lap solver uses the
  full-load efficiency.
- The interpolation branch returns the weighted mean unclamped, which is safe
  only because every contributing sample is inside $(0,1]$; a future change to
  the per-sample filter would silently widen the range.
- Validation evidence: `tests/efficiency-map.test.ts` (fractional reading,
  blank/percentage rejection, duplicate rejection, the 257-sample ceiling, the
  share round trip and a measured map making 0–100 slower) and
  `tests/release-physics.test.ts` (node value used verbatim; a non-finite sample
  falls back to the constant).

## 16. Lap-style sequence integration — `lap-sequence.ts`

### 16.1 Purpose and scope

Integrate a bounded sequence of pedal and gear commands — acceleration, braking,
upshifts, matched or unmatched downshifts, optional rear handbrake — through the
same force chain as the single-run solver, with the shift transient represented
explicitly instead of as a pure torque cut.

### 16.2 Command schema (`parseLapCommands`)

| Column | Range |
|:--|:--|
| `duration_s` | [0.01, 60] |
| `gear` | integer [1, 8] |
| `throttle` | [0, 1] |
| `brake` | [0, 1] |
| `rev_match` | 0 or 1 |
| `handbrake` (optional 6th column) | [0, 1] |

Additional rules: the text is capped at 8000 characters; the first line must be
exactly `duration_s,gear,throttle,brake,rev_match` or that header plus
`,handbrake` (trimmed, lowercased); 1–60 data rows; no empty cell; every cell
numeric; the summed duration must not exceed 180 s. Any violation returns `null`
for the whole batch. The separator is a comma only and there is no quoting.

### 16.3 Integration

- Fixed `dt = 0.01` s, with a point pushed every 10 steps (100 ms) and at the end
  of every phase: `{ timeS, distanceM, speedKmh, rpm, gear, accelMps2 }`.
- $a = F_{\text{net}} / (m + \max(0, \text{rotatingMassKg}))$ — only the static
  fallback enters; the per-gear inertia reflection of §11 is not used here.
- $v_{k+1} = \max(0, v_k + a\,dt)$ and the distance advances by the trapezoid
  $(v_k + v_{k+1})/2 \cdot dt$.
- While the throttle is positive, no cut is active and the RPM is below the
  limiter, the speed is capped at the gear's redline speed. That cap is what lets
  a full-throttle phase sit on the limiter instead of aborting as `overrev`.

### 16.4 Phase force model (`phaseForce`)

$$
F_{\text{drive}} = \frac{T(n_{\text{lookup}})\, i_g i_d \eta}{r_{\text{dyn}}}
\cdot \theta \cdot \lambda,
\qquad
F_{\text{net}} = \min(F_{\text{drive}}, F_{\text{grip}})
- F_{\text{brakes}} - F_{\text{road}}
$$

- $\theta$ is the commanded throttle, $\lambda$ the limiter factor (§15.3) and
  $\eta$ comes from `mappedEfficiency` at $(n, \theta)$.
- $n_{\text{lookup}} = \max(n_{\text{wheel}}, n_{\text{launch}})$ below 1 m/s,
  otherwise $\max(n_{\text{wheel}}, 800)$; `launchRpm` defaults to 2000 rpm here.
- $F_{\text{grip}}$ = `maxDriveForceAtSpeed` with the previous step's signed
  acceleration; $F_{\text{road}}$ = drag + rolling + grade.
- $F_{\text{brakes}}$ = service brake (`brakingTireForce` at the command's brake
  fraction) + handbrake + the coast share, combined by `combinedAxleBraking`
  (§14) so all three draw on one per-axle budget.
- Coast demand = `engineBrakeForceAt(rpm) · (1 − θ)` plus the unmatched-shift
  mismatch term below, limited by `maxCoastForceAtSpeed`.
- A phase whose command carries a `handbrake` value overwrites the running
  gear's `handbrakeFraction` and sets `centerDisengaged = handbrake > 0`, so a
  handbrake phase also frees the centre coupling and the car becomes front-drive
  for its duration.

### 16.5 Gear changes (`changeGear`)

1. `from` = wheel-implied RPM in the old gear, `target` = the same speed in the
   new gear, `blip = max(0, target − from)` when rev-matched, else 0.
2. Torque cut = `shiftTimesS[min(from, to) − 1]`, else `shiftTimeS`, else 0
   seconds (each clamped to [0, 3] s when read by the solver).
3. An **unmatched downshift** adds a spin-up drag after the cut, decayed
   linearly over a 0.2 s settling window (an upshift gives
   $\Delta\omega = 0$, so the term only bites when the new gear would spin the
   engine faster):

$$
F_{\text{mismatch}} = \frac{I_e\,\Delta\omega}{t_{\text{engage}}}
\cdot \frac{i_{\text{new}}\, i_d}{r_{\text{dyn}}},
\qquad
\Delta\omega = \max(0,\, n_{\text{target}} - n_{\text{from}})\,\frac{\pi}{30},
\qquad
t_{\text{engage}} = 0.2\ \text{s}
$$

with $I_e$ = `engineInertiaKgM2 ?? 0.2` kg·m². The 0.2 s engagement is a stated
modeling constant, not a measured clutch curve.
4. Each change is reported as
   `{ timeS, fromGear, toGear, targetRpm, blipRpm, lockRisk }`; `lockRisk` is set
   when any step inside the settling window reports a coast lockup or an axle
   budget overshoot.

### 16.6 Abort conditions

| Code | Trigger |
|:--|:--|
| `invalid` | curve invalid, the serialized commands fail re-validation, a commanded gear exceeds the gearset, a non-finite/out-of-range setup value, initial speed outside [0, 500] km/h, `frontBias` outside [0, 1] |
| `overrev` | at the start of a step, the commanded gear's wheel-implied RPM exceeds `redline + 1` |
| `divergent` | the next speed is non-finite or above 500 km/h |

On abort the partial trajectory and the shifts collected so far are returned.
The over-rev test uses the **commanded** gear's ratio, evaluated before the step
is integrated, which is why an unattainable downshift is refused immediately
rather than after spinning up.

### 16.7 Assumptions and limitations

- **The driver model is uncalibrated.** A command is a fixed pedal fraction for a
  fixed duration; there is no driver-in-the-loop, no target-speed tracking, no
  lap-time optimisation, no tire warm-up and no fuel load.
- Grip is the same quasi-static Kamm chain as the rest of the model: no slip
  curve, no ABS state machine (the same 0.08 s / 0.02 s trim as §14), and the
  handbrake is a budget check, not a locked-rear simulation.
- The rev-match blip is reported, not simulated: it only suppresses the mismatch
  drag term.
- The effective mass uses only the static `rotatingMassKg`, so when physical
  inertias are supplied the lap solver and the single-run solver disagree
  slightly on inertia.
- The static fallback and the per-phase resampling mean a short phase
  (< 100 ms) contributes at most its end point to the returned series.
- Validation evidence: `tests/lap-sequence.test.ts` pins the malformed-command
  rejections, an acceleration → upshift → braking → matched-downshift sequence
  (shift list `[4, 3]`, blip > 0, 8 s total, finite accelerations), the extra
  drag of an unmatched downshift, the `overrev` refusal, the limiter hold without
  a spurious abort, and handbrake phases slowing the car with the centre
  released.

## 17. Corner advice — `corner-advisor.ts`

### 17.1 Apex gear (`apexGearAdvice`)

Corner speed from the radius and the available lateral acceleration:

$$
v_{\text{apex}} = 3.6\sqrt{r\, a_y\, g},
\qquad a_y = \text{lateralG (user input)}
$$

The gears are then scanned from first to top and the first one satisfying

$$
n_{\text{peak torque}} \le \operatorname{rpmFromKmh}(v_{\text{apex}}, i_k) \le 0.9\,n_{\text{red}}
$$

is returned as `{ speedKmh, gear, rpm }`. Scanning from first gear upward means
RPM decreases, so the returned gear is the **tallest** gear that still keeps the
apex above peak torque while staying clear of the limiter — a gear that would lug
below peak torque is skipped, and one within 10 % of the limiter is skipped
because an apex upshift would follow immediately. Guards: `radiusM > 0`,
`lateralG > 0`, `fd > 0`, `circM > 0`, all finite, else `null`; `null` also when
no gear fits the window.

### 17.2 Downshift advice (`downshiftAdvice`)

$$
n_{\text{target}} = \operatorname{rpmFromKmh}(v, i_{\text{to}}),\qquad
\text{blip} = n_{\text{target}} - \operatorname{rpmFromKmh}(v, i_{\text{from}})
$$

The closed-throttle demand is the engine-braking force in the target gear,
limited by the coast-side grip of the driven axle:

$$
F_{\text{demand}} = \operatorname{engineBrake}(n_{\text{target}}, i_{\text{to}}),
\qquad
F_{\text{limit}} = \operatorname{maxCoast}(v, F_{\text{demand}}, a_x = F_{\text{demand}}/m)
$$

$$
a_{\text{decel}} = \frac{\min(F_{\text{demand}}, F_{\text{limit}})}{m},
\qquad
\text{lockRisk} = \text{limit.isLockup}
$$

`null` when the target RPM exceeds the redline (over-rev), when
$i_{\text{to}} \le i_{\text{from}}$, or on any non-positive/non-finite input.

### 17.3 Assumptions and limitations

- No steering or slip-angle model: the corner is a single lateral-g number, so
  the advice is only as good as the grip the user typed in. The GPX helper (§18)
  derives a corner speed from a geometric radius at an assumed 0.8 g.
- Steady-state mid-corner snapshot: no entry/exit phases, no trail braking, no
  banking, no corner-length dependence.
- The load transfer used inside `maxCoast` is driven by $F_{\text{demand}}/m$,
  the requested deceleration, not the achieved one, and the returned
  `decelMps2` omits the rotating-inertia term, so it slightly overstates the
  deceleration the solvers would produce.
- Validation evidence: `tests/release-physics.test.ts` pins that a feasible apex
  gear below redline is returned and that an over-rev downshift returns `null`.

## 18. Gearset search and track targets — `gear-optimizer.ts`

### 18.1 Candidate generation (`gearsetCandidates`)

For a first gear $i_1$ and a gear count $c$, seven geometric gearsets are
generated, one per spacing:

$$
s \in \{0.62,\ 0.66,\ 0.70,\ 0.74,\ 0.78,\ 0.82,\ 0.86\},
\qquad
i_k = \operatorname{round}\!\big(i_1 s^{\,k},\, 3\big),\quad k = 0 \ldots c-1
$$

`count` must be an integer in [2, 8] and `first > 0`, otherwise `[]`. Each
candidate is strictly decreasing with a constant percentage step by construction.

### 18.2 Constraints (`optimizeGearset`)

| Constraint | Rule |
|:--|:--|
| Search bounds | at most the first 1000 candidates and the first 100 final drives are examined |
| Ratio range | every ratio finite and in [0.3, 8.0] |
| Monotonicity | strictly decreasing |
| Maximum drop | $1 - i_{k+1}/i_k \le$ `maxDropFraction`, with `maxDropFraction` in (0, 1) |
| Target speed | top-gear redline speed $\ge$ `targetKmh` |
| Corner windows (optional) | for each of the two corner speeds, gear 2 and then gear 3 (skipped when the gearset is shorter): $1000 \le n \le 0.95\,n_{\text{red}}$ **and** `engineTorqueAt(n) ≥ 0.75 × peakTorqueNm` |
| Guards | `circM > 0`, `redline > 0`, `targetKmh > 0`, `maxDropFraction` in (0, 1); a supplied track target must pass `validateCurve` and carry exactly two corner speeds in (0, 400] |

### 18.3 Objective and the meaning of "optimal"

Among feasible `(gearset, final drive)` pairs the search keeps the one with the
**lowest** top-gear redline speed that still reaches `targetKmh`. The stated
objective is therefore "shortest top gear that satisfies the target", which
minimises cruise RPM and engine speed for that target; nothing in the search
evaluates acceleration, shift time, lap time or fuel use.

This is a **constrained discrete search, not a globally optimal solution**: the
result is the best of the enumerated geometric spacings crossed with the
supplied final drives. A gearset with different spacing, or a final drive outside
the caller's list (the UI offers the current value and ±10 %), can never be
returned, and the corner windows are pass/fail gates rather than objectives.

### 18.4 Track profiles (`TRACK_PROFILES`)

| Profile | `targetKmh` | `minimumLandingFraction` | `cornerSpeedsKmh` |
|:--|:--|:--|:--|
| `tight` | 180 | 0.70 | [45, 70] |
| `balanced` | 240 | 0.65 | [80, 120] |
| `fast` | 300 | 0.60 | [120, 160] |

The Tools panel seeds the four optimizer fields from a profile, converting the
landing fraction to a percentage drop as $(1 - \text{fraction}) \times 100$.
A GPX import (§18.5) seeds the same fields from measured track geometry.

### 18.5 Track geometry from GPX — `gpx-track.ts`

**Purpose.** Derive geometric seeds — total length, longest straight, tightest
corner radius — from a GPX file entirely offline, so the optimizer can be
pre-filled without any map service.

**Great-circle distance** (`trackDistanceM`, haversine form):

$$
h = \sin^2\!\frac{\Delta\varphi}{2}
  + \cos\varphi_a \cos\varphi_b \sin^2\!\frac{\Delta\lambda}{2},
\qquad
d = 2 R \arcsin\sqrt{\operatorname{clamp}(h, 0, 1)},
\qquad R = 6\,371\,000\ \text{m}
$$

**Parsing limits** (`parseGpxTrack`): text $\le 5\,000\,000$ characters;
any `<!DOCTYPE` or `<!ENTITY` makes the whole file return `[]` (no entity
expansion, no XML execution — the parse is a regex scan for
`<trkpt>`/`<ns:trkpt>` tags); `lat` and `lon` are read in either attribute order,
must be finite, $|\text{lat}| \le 90$, $|\text{lon}| \le 180$, and at most
50 000 points are collected.

**Heuristic extraction** (`summarizeTrack`) walks consecutive triples and uses
the triangle's side lengths to get a turn angle and a circumscribed radius:

$$
\text{turn} = \pi - \arccos\frac{a^2 + b^2 - c^2}{2ab},
\qquad
r = \frac{a\,b\,c}{4\sqrt{s(s-a)(s-b)(s-c)}},
\qquad s = \frac{a+b+c}{2}
$$

- The heading-change accumulator sums segment lengths into a straight while the
  accumulated turn stays at or below $\pi/36$ (5°); exceeding it resets the
  straight to the current segment. `longestStraightM` is the longest such run, so
  a straight is not limited by GPS sample spacing.
- `minRadiusM` is the smallest radius among triples whose triangle area exceeds
  0.1 m² and whose two shorter sides are at least 5 m; `null` when no triple
  qualifies.
- `lengthM` and `longestSegmentM` are plain sums/maxima of the segment distances.

**Assumptions and limitations.** These are **geometric seeds, not a track
model**: no elevation, banking, surface or width is read, the radius is a
local circumscribed circle over three noisy GPS fixes, and a long sweeping corner
sampled sparsely can be read as several straights or as a much tighter radius
than reality. The 5 m / 0.1 m² filters exist to keep degenerate and
micro-triangles out of the radius estimate, and the 5° threshold is a fixed
constant rather than a function of sample spacing. The consumer treats the output
as a starting point: the corner speeds are computed at an assumed 0.8 g and the
target speed is picked from three bands (180/240/300 km/h).

**Evidence.** `tests/release-telemetry.test.ts` pins both attribute orders and a
non-zero distance, the rejection of a DOCTYPE, out-of-range latitude and a blank
latitude, and that ten collinear samples produce a straight ≈ the whole length
rather than a per-sample straight.

### 18.6 Assumptions and limitations

- Corner gearing is judged only at two user-supplied speeds; there is no
  distance-weighting along the track.
- The torque-band gate uses the active curve's `peakTorqueNm` at 75 %, an
  absolute threshold that does not adapt to a curve with a very flat or very
  peaky shape.
- No validation against a real gearbox, and no measured track data; evidence is
  internal: `tests/release-telemetry.test.ts` pins target-speed and maximum-drop
  satisfaction, a `null` result when constraints conflict, and both rejection and
  acceptance of a corner window.

## 19. Telemetry analysis and inverse torque — `telemetry-math.ts`

### 19.1 CSV normalization (`parseTelemetryCsv`)

| Rule | Bound |
|:--|:--|
| Text size | $\le 10\,000\,000$ characters |
| BOM | stripped |
| Header detection | first line matching `/rpm\|engine.?speed/i` **and** `/speed\|velocity/i`, so a vendor preamble is skipped |
| Separator | `;` if present in the header, else tab, else `,` |
| Required channels | rpm, speed, time (missing → `[]`) |
| RPM channel names | `rpm`, `enginerpm`, `enginespeed` (after stripping non-alphanumerics and lowercasing) |
| Speed channel names | `wheelspeed`, `speed`, `gpsspeed`, `velocity`; a name containing `mph` or `mps` is rejected instead of converted |
| Time channel names | `time`, `elapsed`, `timestamp` |
| Gear channel | optional `gear` / `gearindex` |
| Data rows | at most the 50 001 lines after the header |
| Row acceptance | finite `timeS ≥ 0`, `rpm` in [0, 30000], `speedKmh` in [0, 600] |
| Time order | strictly increasing; a non-increasing row is dropped |
| Gear | kept only when an integer in [1, 8] |

Cells are unquoted (`""` escapes a quote, a quoted cell may contain the
separator) and a decimal comma is accepted. Output is
`TelemetryRow { timeS, rpm, speedKmh, gear? }`. The parser enforces no sample
gap, only monotonic time.

### 19.2 Ratio recovery (`recoverGearRatios`)

From the speed relation of §4, the implied gear ratio at a sample is

$$
i = \frac{n \cdot C \cdot 0.06}{v \cdot i_d}
$$

Samples below 15 km/h or 1000 rpm are ignored, as are implied ratios outside
[0.3, 8.0]. Surviving samples are clustered online: a sample joins the **first**
group whose running mean is within 6 % (`|center − i|/center < 0.06`), otherwise
it opens a new group, up to 64 groups. Groups with fewer than three samples are
discarded. Per group:

- the reported ratio is the **median** of its samples, which rejects the tail
  that a mean would follow;
- the reported `slipFraction` is the share of samples more than 3 % away from
  that median — a diagnostic, not a filter, so the outliers stay in the median
  computation.

Output is sorted tallest-first and capped at 8 entries. Assumptions: the final
drive and effective circumference are known and constant (the caller passes
`effectiveCircumferenceM`, so neither tire growth nor load squash is applied);
clutch slip or wheelspin inside a nominal gear inflates the ratio and appears as
a slip fraction; a cluster of ≥ 3 outliers can be reported as a gear; and
overlapping gears (a 1.5-way spread) are separated only by the 6 % tolerance.

### 19.3 Inverse torque (`inverseDyno`)

For each interior sample whose gear equals both neighbours' and whose speed is at
least 15 km/h:

$$
a = \frac{v_{k+1} - v_{k-1}}{3.6\,(t_{k+1} - t_{k-1})},
\qquad
F_w = m\,a + F_{\text{drag}}(v) + F_{\text{roll}}(v) + F_{\text{grade}}
$$

$$
T = \frac{F_w \cdot C}{2\pi\, i_g\, i_d\, \eta}
$$

Rows are skipped when the acceleration is $\le 0$ or $> 20$ m/s², when the
centred interval exceeds 2 s, when the gear channel is absent or differs from
either neighbour, or when the gear index has no entry in the supplied gearset.
The ratio used is the setup's `gears[gear − 1]`, never the ratio recovered by
`recoverGearRatios`. Torque samples are binned to the nearest 250 rpm and
averaged, then passed through `sanitizeTorquePoints` (RPM [500, 15000], torque
[5, 5000] Nm, sorted, de-duplicated); fewer than two surviving points yields
`null`.

Assumptions the estimate makes: the mass is constant and **no** rotating-inertia
correction is applied; $\eta$ is the constant drivetrain value, never the
measured map; the road-load model is the same one the forward solver uses, so a
wrong $C_dA$ or $C_{rr}$ bias enters the torque estimate directly; the grade is a
single user value; there is no torque-converter slip, turbo lag or driveline
wind-up; and wheelspin appears as extra torque. The output is therefore the crank
torque that would have produced the observed acceleration **under this model**,
not an independent measurement of engine output.

### 19.4 Evidence

`tests/release-telemetry.test.ts` pins canonical-channel reading with duplicate
timestamps dropped, a decimal-comma semicolon log with a vendor preamble, the
rejection of an `mph` speed channel, recovery of a known ratio from locked-clutch
samples, and the refusal to derive torque across a gear change.

## 20. Setup sensitivity — `setup-sensitivity.ts`

### 20.1 Method

A one-sided finite difference at **+5 %** on each of five inputs, evaluated on
copies so the live state is never touched:

| Input | Perturbation |
|:--|:--|
| `gears` | every ratio × 1.05 |
| `fd` | final drive × 1.05 |
| `tire` | effective circumference × 1.05 |
| `mass` | mass × 1.05 |
| `grip` | `roadFrictionCoefficient` × 1.05 |

### 20.2 Reported metrics

| Field | Definition |
|:--|:--|
| `topSpeedDeltaPercent` | $(v^{\text{var}}_{\text{top}}/v^{\text{base}}_{\text{top}} - 1) \times 100$ with $v_{\text{top}} = \min(v_{\text{aero}}, v_{\text{gearing}})$; when the aero solve returns $\le 0$ (no drag) only the top-gear redline speed is used; 0 when the baseline is 0 |
| `shiftDeltaRpm` | shift target of **gear pair 1** (index 0) minus the baseline target, in RPM; the baseline is the redline when no crossing qualifies |
| `accelDeltaPercent` | $(t^{\text{var}}_{0\text{–}100}/t^{\text{base}}_{0\text{–}100} - 1) \times 100$, `null` when either run fails to reach 100 km/h |

### 20.3 Ranking

$$
\text{strength} = \max\!\Big(|\Delta v_{\text{top}}\%|,\;
|\Delta t_{0\text{–}100}\%| \text{ or } 0,\;
\Big|\frac{\Delta n_{\text{shift}}}{n_{\text{shift,base}}}\Big| \times 100\Big)
$$

Rows are sorted by descending strength; the comparator is stable, so equal
strengths keep the declaration order. The three metrics are ranked together, so a
row can lead the list on a large top-speed effect while its 0–100 effect is
small.

### 20.4 Approximations and limitations

- **Top speed uses the constant efficiency**: `evaluate` calls
  `dragLimitedSpeedKmh(peakPowerKw × drivetrainEff, …)`, so a loaded measured map
  does not enter the top-speed metric, while the shift metric does receive it and
  the acceleration metric re-runs the full solver (which uses it). The three
  metrics therefore do not all come from the same efficiency path.
- Only the first gear pair is inspected for the shift metric; a change that moves
  a later upshift is invisible to `shiftDeltaRpm`.
- A +5 % step is a local linearisation: no second-order term and no central
  difference, so a non-monotone response (gearing crossing the drag limit) is
  reported as its one-sided slope.
- An absent curve makes `evaluate` return `{ top: 0, shift: 0, accel: null }`, so
  a missing curve produces neutral rows instead of an error.
- Validation evidence: `tests/setup-sensitivity.test.ts` pins that all five rows
  are present with finite signed values, that mass has a non-positive top-speed
  effect, that the input object is not mutated, and that the fd/tire signs are
  preserved when gearing (not drag) limits the speed.

## 21. Performance session metrics — `performance-session.ts`

### 21.1 Input sample shape

`PerformanceSample { timeS, speedKmh, accuracyM }`. Coordinates are deliberately
absent: the GPS recorder discards `latitude`/`longitude`, and the storage
sanitizer strips any unrecognized field again on load.

### 21.2 Acceptance rules (`measurePerformanceSession`)

| Rule | Bound |
|:--|:--|
| Sample count | $\ge 2$ |
| `timeS` | [0, 120] s |
| `speedKmh` | [0, 500] |
| `accuracyM` | [0, 15] |
| First sample | speed $\le 1$ km/h (an armed standstill), else all metrics are `null` |
| Sample gap | $0 < dt \le 2$ s for every consecutive pair, else all metrics are `null` |
| Clock origin | the time of the sample **before** the first sample above 1 km/h, so the standing-start lead-in is excluded |

### 21.3 Derived metrics

Distance advances by the trapezoid in metres:

$$
\Delta s = \frac{v_a + v_b}{7.2}\,dt \qquad (v \text{ in km/h})
$$

- **0–100 km/h**: the crossing is interpolated linearly inside the bracketing
  sample, then measured from the clock origin.
- **1/4 mile** ($402.336$ m, `PERF_QUARTER_MILE_M`): inside the bracketing sample
  and assuming constant acceleration,

$$
v_{\text{at}} = \sqrt{v_a^2 + 2\,a\,s_r},
\qquad
\Delta t = \frac{2\,s_r}{v_a + v_{\text{at}}}
$$

- `distanceM` is the total integrated distance over the accepted trace.

### 21.4 Export (`performanceSessionCsv`)

`time,speed_kmh,accuracy_m` with fixed decimals (3 / 3 / 1) — a speed-only trace
with no location channel, so a session can be shared or archived without
revealing where it was driven.

### 21.5 Assumptions and limitations

- GPS speed is taken at face value: no smoothing and no derivative filtering, so
  a lagging or jumping fix propagates straight into distance and time.
- The gates are 15 m accuracy, a 2 s maximum gap and a 120 s maximum duration; the
  recorder adds a 2 s freshness gate (|now − fix timestamp| > 2 s is rejected) and
  stops on a > 2 s gap, so a session is always a continuous foreground trace.
- No reaction-time handling, no wheel/radar correction, no grade or wind
  correction, and no correction for a rolling start beyond the standstill gate.
- The quarter mile is `402.336` m here and `402.33928` m in `accel-math.ts`. The
  3.3 mm difference is far below GPS resolution, but the two literals disagree
  and should be unified by the maintainer; the modelled and the measured
  quarter-mile are therefore not the same distance by definition.
- Validation evidence: `tests/release-storage.test.ts` pins a 0–100 estimate of
  ≈ 20 s on a 5 km/h/s trace, a non-null quarter mile, the rejection of stale
  samples / rolling starts / weak accuracy, and quarter-mile interpolation equal
  to $\sqrt{402.336}$; `tests/performance-recorder.test.ts` pins the acquisition
  lifecycle, the standstill requirement, the freshness and accuracy gates and the
  stop across a missing GPS interval.

## 22. Units and axes — `unit-utils.ts`

- Speed grid step: 50 (km/h) / 25 (mph).
- RPM axis ceiling: $\lceil n_{\text{red}}/1000 \rceil \cdot 1000 + 500$.
- Power display: `toDisplayPower`/`fromDisplayPower` swap kW ⇄ cv via
  `KW_TO_HP`, with `formatPower` emitting one decimal place.
- Display preferences persisted in `haguruma-unit` / `haguruma-power-unit`.

## 23. Drivetrain efficiency — `drivetrain-eff.ts`

Default crank-to-wheel efficiency by driven layout (manual gearbox baseline):

| Layout | $\eta$ |
|:--|:--|
| FWD | 0.90 |
| RWD | 0.85 |
| AWD | 0.80 |

Unknown layouts fall back to RWD. This constant is the **fallback** everywhere:
when a measured efficiency map is present in `state.simulation.efficiencyMap`,
`mappedEfficiency` (§15) replaces it at the queried operating point, and the
layout default is only the value returned when the map yields no valid weight
(empty or fully invalid sample list).

## 24. Module dependency graph

Import direction is strictly acyclic and one-way (a module only imports from
layers above it):

```
leaf modules (no imports at all):
  powertrain-math.ts   gpx-track.ts   performance-session.ts

leaf modules (only ../models or ../state):
  tire-math.ts   speed-math.ts   engine-curve-core.ts   inertia-math.ts   aero-math.ts
  recovery-math.ts   drivetrain-eff.ts

efficiency-map.ts      -> powertrain-math.ts (type only)
dyno-csv.ts            -> engine-curve-core.ts, aero-math.ts
traction-math.ts       -> speed-math.ts, engine-curve-core.ts, powertrain-math.ts
shift-math.ts          -> speed-math.ts
dynamics-math.ts       -> speed-math.ts, traction-math.ts, aero-math.ts, tire-compounds (grip gain)
braking-simulation.ts  -> dynamics-math.ts, aero-math.ts, tire-compounds (grip gain)
handbrake-math.ts      -> dynamics-math.ts, tire-compounds (grip gain),
                          braking-simulation.ts (type only)
cruise-math.ts         -> aero-math.ts, speed-math.ts, traction-math.ts
brake-math.ts          -> dynamics-math.ts (GRAVITY)
corner-advisor.ts      -> speed-math.ts, dynamics-math.ts, traction-math.ts
gear-optimizer.ts      -> speed-math.ts, traction-math.ts
telemetry-math.ts      -> aero-math.ts, engine-curve-core.ts
setup-sensitivity.ts   -> accel-math.ts, aero-math.ts, speed-math.ts, traction-math.ts

accel-math.ts          -> aero-math.ts, dynamics-math.ts, inertia-math.ts, powertrain-math.ts,
                          speed-math.ts, traction-math.ts, handbrake-math.ts
lap-sequence.ts        -> accel-math.ts (type only), traction-math.ts, speed-math.ts,
                          dynamics-math.ts, aero-math.ts, braking-simulation.ts,
                          powertrain-math.ts, handbrake-math.ts, ../state/app-state
                          (defaultRunningGear)
unit-utils.ts          -> aero-math.ts
```

Two edges are worth noting because they break the "math modules never touch
state" rule: `lap-sequence.ts` imports `defaultRunningGear` from
`../state/app-state`, and `handbrake-math.ts`/`braking-simulation.ts` import the
tire-compound catalog from `../../config`. Everything else in `src/core/math/`
depends only on other math modules and `../models`.

No module imports `accel-math`, `cruise-math` or `dynamics-math` back; the
solver layer stays at the top of the graph. `lap-sequence.ts` sits above
`accel-math.ts` but only for the `SimInput` type, so there is no runtime cycle.

`traction-math.ts` re-exports the whole `engine-curve-core.ts` surface, so
consumers can import curve symbols and force symbols from one entry point.

Call chain of one full render (per gear):

```
state -> validateCurve() -> tractiveForceAt() -> optimalShiftFor()
       -> criticalWheelspinSpeed() / criticalCoastLockupSpeed()
       -> roadLoadPowerKw() -> dragLimitedSpeedKmh()
       -> simulateAcceleration() (KPI strip, memoized)
```

Call chains of the Tools card (each runs only when the user presses its button):

```
braking chart   -> simulateBraking()  -> brakingTireForce() -> wheelLoads/downforceN/kammLimit
lap sequence    -> simulateLapSequence() -> phaseForce() -> tractiveForceAt + maxDriveForceAtSpeed
                                        + brakingTireForce + handbrakeForceAtSpeed
                                        + combinedAxleBraking + engineBrakeForceAt
corner advice   -> apexGearAdvice() / downshiftAdvice() -> engineBrakeForceAt + maxCoastForceAtSpeed
optimizer       -> gearsetCandidates() -> optimizeGearset() -> speedKmh + engineTorqueAt
                   (+ parseGpxTrack() / summarizeTrack() to seed the targets)
telemetry       -> parseTelemetryCsv() -> recoverGearRatios() / inverseDyno()
                   -> sanitizeTorquePoints -> resampleTorquePoints -> state.torqueCurvePoints
sensitivity     -> setupSensitivity() -> simulateAcceleration + dragLimitedSpeedKmh + optimalShiftFor
performance     -> measurePerformanceSession() (GPS samples) vs simulateAcceleration() prediction
```

## 25. Function index

| Module | Exports |
|:--|:--|
| `tire-math.ts` | `parseTire`, `clampRollingFactor`, `effectiveCircumferenceM`, `tireGrowthFactorAtSpeed`, `dynamicCircumferenceM`, `loadedDynamicRadiusM`, `ROLLING_FACTOR_DEFAULT/MIN/MAX`, `TIRE_GROWTH_REF_KMH/MAX`, `SIDEWALL_STIFFNESS_DEFAULT_NPM` |
| `speed-math.ts` | `speedKmh`, `rpmFromKmh`, `toDisplaySpeed`, `fromDisplaySpeed`, `calculateSpeed`, `calculateRpm`, `KMH_PER_MPH`, `MPH_PER_KMH` |
| `engine-curve-core.ts` | `validateCurve`, `enginePowerAt`, `engineTorqueAt`, `torqueAtRpm`, `anchorsFromPoints`, `sanitizeTorquePoints`, `torqueFromPower`, `powerFromTorque`, `clamp`, `KW_TO_NM`, `CURVE_MIN_RPM`, `POINTS_*` |
| `dyno-csv.ts` | `parseDynoCsv`, `smoothTorquePoints`, `smoothTorquePointsSG`, `smoothTorquePointsMedian`, `resampleTorquePoints`, `MAX_CURVE_POINTS` |
| `traction-math.ts` | `tractiveForceAt`, `dynamicRadiusM`, `optimalShiftFor`, `optimalShiftsForAll` (+ all `engine-curve-core` exports) |
| `shift-math.ts` | `describeUpshift`, `describeAllUpshifts`, `describeShiftDelta`, `describeAllShiftDeltas`, `judgeShifts`, `speedForLandingRpm` |
| `aero-math.ts` | `dragForce`, `rollingForce`, `rollingForceAtSpeed`, `rollingCrrAtSpeed`, `gradeForce`, `roadLoadPowerKw`, `dragLimitedSpeedKmh`, `availableWheelKw`, `kwToHp`, `hpToKw`, `kmhToMs`, `clampGrade`, `ROLLING_SPEED_REF_KMH` |
| `dynamics-math.ts` | `staticAxleLoads`, `longitudinalTransfer`, `lateralTransfer`, `wheelLoads`, `drivenWheelsLoad`, `downforceN`, `compressionMm`, `kammLimit`, `diffLimit`, `maxDriveForceAtSpeed`, `maxCoastForceAtSpeed`, `engineBrakeForceAt`, `criticalWheelspinSpeed`, `criticalCoastLockupSpeed`, `GRAVITY`, `TORSEN_TBR`, `ENGINE_BRAKE_FRACTION` |
| `inertia-math.ts` | `equivalentRotatingMassKg`, `launchRotatingMassKg`, `RotatingInertiaInput` |
| `brake-math.ts` | `idealBrakeBiasFront`, `stoppingDistanceM`, `REAR_LOCK_SHARE`, `BrakeBias` |
| `recovery-math.ts` | `gearDropRecoveryMs` |
| `accel-math.ts` | `simulateAcceleration`, `QUARTER_MILE_M`, `SIXTY_FT_M`, `SIXTY_MPH_KMH` |
| `cruise-math.ts` | `cruiseCheck`, `CRUISE_MIN_RPM`, `CRUISE_HIGH_RPM_FRACTION` |
| `powertrain-math.ts` | `mappedEfficiency`, `limiterTorqueFactor`, `EfficiencySample` |
| `efficiency-map.ts` | `validateEfficiencyMap`, `parseEfficiencyCsv` |
| `braking-simulation.ts` | `brakingTireForce`, `simulateBraking`, `BrakingInput`, `BrakingPoint`, `BrakingTireForces`, `BrakingResult` |
| `handbrake-math.ts` | `handbrakeForceAtSpeed`, `combinedAxleBraking` |
| `lap-sequence.ts` | `parseLapCommands`, `simulateLapSequence`, `LapCommand`, `LapPoint`, `LapShift`, `LapResult` |
| `corner-advisor.ts` | `apexGearAdvice`, `downshiftAdvice` |
| `gear-optimizer.ts` | `gearsetCandidates`, `optimizeGearset`, `TRACK_PROFILES`, `TrackGearingTarget` |
| `gpx-track.ts` | `trackDistanceM`, `parseGpxTrack`, `summarizeTrack`, `TrackPoint` |
| `telemetry-math.ts` | `parseTelemetryCsv`, `recoverGearRatios`, `inverseDyno`, `TelemetryRow`, `RecoveredRatio`, `InverseDynoInput` |
| `setup-sensitivity.ts` | `setupSensitivity`, `SensitivityRow` |
| `performance-session.ts` | `measurePerformanceSession`, `performanceSessionCsv`, `PerformanceSample`, `PerformanceMetrics` |
| `unit-utils.ts` | `getSpeedStep`, `getUnitLabel`, `getMaxRpm`, `getPowerUnitLabel`, `parseUnit`, `parsePowerUnit`, `toDisplayPower`, `fromDisplayPower`, `formatPower`, `formatPowerInput`, `initUnit`/`storeUnit`, `initPowerUnit`/`storePowerUnit` |
| `drivetrain-eff.ts` | `DEFAULT_DRIVETRAIN_EFF`, `efficiencyForLayout` |

Key interfaces: `EngineCurve`, `TorqueCurvePoint`, `RunningGear` (`models.ts`),
`OptimalShift`, `ShiftStep`, `ShiftVerdict`, `ShiftPointDelta`, `SimInput`,
`SimResult`, `CruiseInput`, `CruiseResult`, `BrakingInput`, `BrakingResult`,
`LapCommand`, `LapResult`, `EfficiencySample`, `TrackGearingTarget`,
`TelemetryRow`, `SensitivityRow`, `PerformanceSample`, `PlotFrame`.

Interfaces that are declared by one module and consumed by another are also part
of the contract: `EfficiencySample` (`powertrain-math.ts`) is re-exported through
`traction-math.ts` and `accel-math.ts`, `BrakingTireForces`
(`braking-simulation.ts`) is the input of `combinedAxleBraking`, and `SimInput`
(`accel-math.ts`) is the input of both `lap-sequence.ts` and
`setup-sensitivity.ts`.

## 26. Input ranges and guards

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
| Per-upshift cut times `shiftTimesS` | at most 7 entries, each [0, 3] s | `parseSimulationSettings`, `simulateAcceleration` |
| Limiter mode | `'hard'` or `'bounce'` | `parseSimulationSettings`, `limiterTorqueFactor` |
| Reaction time | [0, 5] s | `simulateAcceleration` |
| Launch RPM | [`CURVE_MIN_RPM`, redline] | `resolveLaunchRpm` |
| Efficiency map size | 2 … 256 samples, unique `(rpm, load)` | `validateEfficiencyMap` |
| Efficiency map RPM | [500, 15000] | `validateEfficiencyMap` |
| Efficiency map load | [0, 1] | `validateEfficiencyMap` |
| Efficiency map value | $(0, 1]$ (fraction, not %) | `validateEfficiencyMap` |
| Efficiency CSV | $\le 50\,000$ characters, exact 3-column header | `parseEfficiencyCsv` |
| Braking speed / bias / mass | speed [0, 500] km/h, bias [0, 1], mass > 0 | `simulateBraking` |
| Braking integration | 12 000 steps at 0.01 s (120 s ceiling) | `simulateBraking` |
| Handbrake fraction | [0, 1] (clamped; $\le 0$ returns 0 N) | `handbrakeForceAtSpeed` |
| Differential preload | [0, 1000] Nm; radius floored at 0.1 m | `drivenAxleLimitN` |
| Downforce reference area | [0.5, 5] m² on share decode, default 2.0 m² | `running-gear-share.ts`, `defaultRunningGear` |
| AWD front share | [0, 1] (clamped; 0 = rear-only, 1 = front-only) | `drivenAxleLimitN` |
| Lap command duration | [0.01, 60] s, total $\le 180$ s | `parseLapCommands` |
| Lap command gear | integer [1, 8] and $\le$ gearset length | `parseLapCommands`, `simulateLapSequence` |
| Lap throttle / brake / rev-match / handbrake | [0, 1] / [0, 1] / {0, 1} / [0, 1] | `parseLapCommands` |
| Lap command rows / text | $\le 60$ rows, $\le 8000$ characters | `parseLapCommands` |
| Lap initial speed / front bias | [0, 500] km/h / [0, 1] | `simulateLapSequence` |
| Apex advice inputs | radius > 0, lateral g > 0, fd > 0, circM > 0 | `apexGearAdvice` |
| Downshift advice inputs | speed ≥ 0, 0 < fromRatio < toRatio, mass > 0 | `downshiftAdvice` |
| Gearset candidate count | integer [2, 8], first ratio > 0 | `gearsetCandidates` |
| Gearset search ratios | [0.3, 8.0], strictly decreasing, drop < `maxDropFraction` ∈ (0, 1) | `optimizeGearset` |
| Gearset search lists | first 1000 candidates, first 100 final drives | `optimizeGearset` |
| Corner targets | exactly 2 speeds in (0, 400] km/h, curve must validate | `optimizeGearset` |
| GPX text / points / coordinates | $\le 5$ MB, $\le 50\,000$ points, \|lat\| ≤ 90, \|lon\| ≤ 180, no DOCTYPE/ENTITY | `parseGpxTrack` |
| Telemetry text / rows | $\le 10$ MB, 50 001 lines after the header | `parseTelemetryCsv` |
| Telemetry channels | time ≥ 0, rpm [0, 30000], speed [0, 600] km/h, strictly increasing time | `parseTelemetryCsv` |
| Recovered ratio | [0.3, 8.0], ≥ 3 samples, ≤ 8 reported | `recoverGearRatios` |
| Inverse-dyno acceleration | (0, 20] m/s², centred interval $\le 2$ s | `inverseDyno` |
| GPS sample | time [0, 120] s, speed [0, 500] km/h, accuracy [0, 15] m, gap $\le 2$ s | `measurePerformanceSession`, `PerformanceRecorder` |
| GPS fix freshness | \|now − fix timestamp\| $\le 2$ s | `PerformanceRecorder.receive` |

Every other function returns `0`, `null` or a null-result object rather than
`NaN`/`Infinity`; guards are listed per function in the TSDoc. Clamping is
silent in the places listed above (the value is rescued, not rejected), while the
CSV/JSON importers reject the whole payload instead of importing a subset.

## 27. Unit conversions quick reference

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

## 28. Worked example

Fixture (matches `tests/traction-math.test.ts`): redline 7200 rpm, peak torque
180 Nm @ 4500 rpm, peak power 110 kW @ 6500 rpm, gears 3.58 / 2.05 / 1.38 / 1.00,
fd 4.10, `circM` 1.935 m, $\eta$ 0.85. Road: mass 1200 kg, $C_d A$ 0.65 m²,
$C_{rr,0}$ 0.013, flat. The constant `drivetrainEff` is used throughout — no
measured efficiency map is loaded, so §15.2 degenerates to the fallback.

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

## 29. Assumptions and limitations

Deliberately **not** modeled — useful to know before trusting a number:

- **Tire grip:** one $\mu$ per setup with a Kamm circle. No slip curve /
  Pacejka, no load sensitivity of $\mu$, no pressure, temperature, wear or
  relaxation length, so grip is symmetric and rate-independent.
- **Tire geometry:** the radius actually used is
  `dynamicRadiusM(C_eff) = C_eff / 2π` with the fixed `rollingFactor` squash of
  §3.2 and **no vertical-load term**; `loadedDynamicRadiusM` (load-sensitive
  radius) and the centrifugal growth of `dynamicCircumferenceM` are implemented
  and unit-tested but not called by any runtime path (§3.3, §3.4). Vertical load
  therefore does not change gearing anywhere in the model.
- **Load transfer:** quasi-static. No suspension compliance, roll stiffness,
  anti-dive/squat, ride-height or transient (damped) transfer. Wheel loads are
  clamped at 0, so wheel lift is treated as zero load, not a lift event.
- **Lateral:** `lateralG` is a user input, not solved from a corner or steering
  geometry. The braking and handbrake budgets consume it as a constant lateral
  demand, so a straight-line stop and a corner stop are the same computation with
  a different input.
- **Aero:** steady-state $C_L A$ and $C_d A$; no pitch/rake or ground-effect
  variation, no wind (air speed equals ground speed).
- **Differential:** the accel-side limit is
  `min(F_inner + F_outer, diffLimit(type, bias, …) + preload)` with
  `preload = differentialPreloadNm / max(0.1, preloadRadiusM)`; preload is a
  constant breakaway torque, so there is no ramp-angle curve, no viscous
  coupling, no plate wear and no temperature hysteresis, and the Torsen transfer
  bias is fixed at 3.0. The **AWD centre split is implemented** but is a share
  rule, not a coupling model: `centerDisengaged` sends all drive to the front,
  `activeCenter` allocates the two axles by remaining friction capacity, and
  otherwise a fixed `awdFrontShare` (default 0.5) divides the demand with
  `min(front/split, rear/(1−split))`. There is no centre clutch torque curve, no
  slip across the coupling and no torque-vectoring.
- **Engine:** quasi-static torque curve. No turbo spool dynamics, intake
  transients or thermal derate. The rev limiter is a torque gate
  (`limiterTorqueFactor`, §15.3), not a bounce in the engine model: the curve
  itself keeps producing power above the redline, and the gate is what removes it
  — a `bounce` mode is a square-wave cut inside a 150-rpm window, and the lap
  solver additionally caps the speed at the gear's redline speed.
- **Driveline:** an upshift is a torque cut for `shiftTimeS` (or the per-upshift
  `shiftTimesS[gear]`); the only other inertia effect is the reflected equivalent
  mass. No clutch slip model beyond the `launchRpm` hold, no driveshaft wind-up.
  The lap sequence adds one extra transient: an unmatched shift applies a
  constant spin-up drag over a fixed 0.2 s engagement window (§16.5), which is a
  stated constant rather than a measured clutch curve.
- **Braking:** the pedal is a friction demand split by a fixed front bias. ABS is
  a periodic 10 % demand trim (0.9 during 20 ms of each 80 ms), a locked non-ABS
  tire is credited with 0.75 × its capacity, and there is no slip controller,
  brake torque curve, pad fade, brake balance drift or brake-temperature model.
  Wheel lock is reported as a demand-versus-budget flag, never as a computed
  slip.
- **Handbrake:** a rear-axle force derived from the live rear Kamm budget times
  the demanded fraction; no cable/drum geometry, no hydraulic share with the
  service circuit, no rear-wheel lockup state, and the front axle never
  contributes.
- **Powertrain efficiency:** the constant layout default (§23) unless the user
  imports a measured map. No factory calibration ships with the project, so an
  out-of-the-box run is not efficiency-calibrated. The map has only an RPM and a
  load axis, uses inverse-distance interpolation (§15.2), and is queried at full
  load everywhere except the lap solver.
- **Lap driver model:** uncalibrated. A command is a fixed pedal fraction for a
  fixed duration; there is no target-speed tracking, no lap-time optimisation,
  no tire warm-up, no fuel load and no driver reaction. Outputs are a
  consequence of the command list, not a prediction of what a driver would do.
- **Gearset search:** a constrained discrete search over seven geometric spacings
  crossed with the supplied final drives, ranked by "shortest top gear that
  reaches the target" (§18.3). It is not a global optimum and does not evaluate
  acceleration, shift time or lap time; a different spacing or an unlisted final
  drive can never be returned.
- **GPX geometry:** the corner radius and straight lengths are geometric seeds
  from noisy GPS fixes (local circumscribed circle, 5° heading-change threshold,
  5 m / 0.1 m² filters). No elevation, banking, surface or width, and a sparsely
  sampled corner can read as a straight or as a much tighter radius (§18.5).
- **GPS measurement:** the performance-session metrics accept the reported GPS
  speed at face value, gate it on 15 m accuracy, a 2 s sample gap, a 2 s fix
  freshness and a 120 s duration, and require an armed standstill. There is no
  smoothing, no wheel/radar correction, no grade or wind correction, and the
  modelled and measured quarter-mile literals differ by 3.3 mm (§21.5).
- **Rolling resistance:** grows linearly with speed above the base $C_{rr,0}$;
  no temperature or belt/compound effects.
- **Road:** constant grade; no curvature, banking or surface change over
  distance.
- **Validation status:** every relation here is an implementation of a documented
  model, pinned by the suites in §33. There is no corpus of measured vehicle,
  dyno or lap data against which the model as a whole has been validated.

## 30. Validation anchors

The table below lists the checks that tie the implementation to a value decided
**outside** the implementation. They are **expectations and derivations, not
measurements**: a geometry identity, a closed-form result, a documented
constant, or an owner-supplied specification. None of them is a recorded
dynamometer, GPS or track measurement, and no anchor validates the model as a
whole — they pin individual relations.

| Anchor | Expected | Basis / evidence type |
|:--|:--|:--|
| `205/55R16` geometry | Ø 631.9 mm, $C_{\text{geo}}$ 1.9852 m, $r_{\text{dyn}}$ ≈ 0.3080 m | geometric derivation from the ETRTO dimensions; `tests/tire-math.test.ts` asserts only width, rim diameter and a 1800–2100 mm band |
| `195/60R15` geometry | Ø 615 mm, circumference 1.9321 m | geometric derivation; the value is *used* (not asserted verbatim) by the Eclipse reverse-top-speed check in `tests/speed-math.test.ts` |
| Eclipse 1G reverse top speed | ≈ 61 km/h | owner-supplied preset data (7000 rpm, $i$ 3.083, $i_d$ 4.322); the test accepts a 55–68 km/h band |
| Eclipse 1G 5th-gear Vmax | 215–220 km/h @ ≈ 5900–6100 rpm | owner/README specification, not a measured run; `tests/aero-math.test.ts` asserts 205 < limit < 235 km/h |
| Rolling factor | 0.975 | published ISO/ETRTO loaded-tire baseline; `tests/tire-math.test.ts` pins the factor through `effectiveCircumferenceM` and `clampRollingFactor` |
| Tire growth at 250 km/h | exactly ×1.03 | cap of the implemented formula, asserted to 4 decimals in `tests/tire-math.test.ts`; **not used by any runtime caller** (§3.3) |
| Loaded radius at 3433 N | $r \cdot 2\pi \approx 0.976\,C_{\text{geo}}$ | default 450000 N/m stiffness, asserted in `tests/tire-math.test.ts`; **not used by any runtime caller** (§3.4) |
| 100–0 km/h stop on $\mu$ 1.0 | ≈ 39.3 m | closed form $v^2/2a$; `tests/brake-math.test.ts` recomputes the same formula, so it proves consistency, not an independently measured stop |
| Torque peak on the anchor ramp | ≥ 50 % of peak at 1000 rpm, 100 % at `peakTorqueRpm` | implemented piecewise relation, asserted against the formula |
| Dyno tail at redline | 90 % of the last measured power | `POINT_TAIL_TAPER` constant |
| Quarter mile | 402.33928 m (`accel-math`) / 402.336 m (`performance-session`) | international statute-mile definition; the two literals differ by 3.3 mm (§21.5) |
| Eclipse 1G GS hero preset | mass 1270 kg, $C_d$ 0.29, frontal area 1.95 m², ratios and a 3.083 reverse | owner-supplied data, asserted in `tests/presets.test.ts` |

## 31. Graph coordinate mapping

The canvas is not physics, but the plot lives in the same units. Mapping in
`canvas-setup.ts` (CSS pixels):

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

Paddings (top/right/bottom/left) = 25/30/40/55. Axis ceiling
$n_{\max} = \lceil n_{\text{red}}/1000 \rceil · 1000 + 500$; $v_{\max}$ is the
state's `maxGraphSpeed`. HiDPI: the backing store is `round(cssSize × dpr)` with
`dpr = min(devicePixelRatio, 2)`, and the context transform is set so all
mapping stays in CSS pixels.

Ghost-delta readout (v0.5.0, `describeAllShiftDeltas` in `shift-math.ts`,
rendered as DOM rows in `#comp-shift-deltas`): at each primary up-shift
point, $\Delta n$ compares the next-gear landing RPM of both setups at the
same road speed and $\Delta v$ compares the same-gear shift-point speeds; the
canvas stays curve-only.

## 32. Extending the model

When adding physics:

1. Put pure math in a new `src/core/math/<name>-math.ts` (`@file` + `@brief`).
2. Validate inputs and return a neutral value on bad data; never throw.
3. Keep SI inside and convert units only at the boundary.
4. Add a TSDoc block (`@brief`, `@param`, `@return`) to every function.
5. Export constants with the formulas that use them; do not duplicate units.
6. Add a mirror suite in `tests/<name>-math.test.ts`, plus a README / AGENTS.md row.
7. Keep the file under 400 lines and functions under 50 lines.
8. Keep the import graph of §24 one-way: a new module may import from layers
   below it, never from the solver layer above it, and should not reach into
   `../state` unless it genuinely needs live defaults.
9. Update this document: the section for the module, the §25 function index, the
   §26 guards table and the §33 coverage map. If the change makes a formula here
   inaccurate, fix the text — a dormant function must be labelled as dormant.

## 33. Test coverage map

45 `.test.ts` suites plus one benchmark file, with fixtures in
`tests/fixtures/` (`accel-benchmark.ts`, imported by five suites, and
`efficiency-map.csv`, which is currently imported by none of them — the
efficiency-map suite builds its maps inline). Run the suites with `npm test`
(or `npx vitest run tests/<file>.test.ts`); the benchmark and the host-speed gate
are `npm run bench`.

**What these suites are.** They are unit and regression tests: they assert the
relations the implementation intends (monotonicity, round trips, guards,
catalog ordering, i18n parity, legacy-safe decoding, exported-value stability)
against values computed for those same relations. That is a correctness net for
the code, **not** validation of the physics against independent measured vehicle
data. The only external anchors are the ones listed in §30, and even those are
expectations and derivations rather than recorded measurements. Everything else
is internal consistency.

### Physics and math (14 suites)

| Suite | Pins |
|:--|:--|
| `tire-math.test.ts` | parsing, circumference band, rolling factor, centrifugal growth and its cap, and the load-sensitive radius of the **unused** `loadedDynamicRadiusM` |
| `speed-math.test.ts` | SI speed/RPM round trip, mph boundary, zero instead of `NaN`, the Eclipse reverse top speed anchor |
| `engine-curve-akima.test.ts` | Akima interpolation, exactness at nodes, no overshoot, two-point fallback |
| `traction-math.test.ts` | torque/power round trip, peak anchors, droop past peak power, curve validation, tractive force, optimal shift per gear pair |
| `shift-drops.test.ts` | landing RPM, drops, verdicts and the primary/comparison shift-point deltas |
| `aero-math.test.ts` | drag, speed-sensitive rolling resistance, grade, power balance and the top-speed bisection |
| `dynamics-math.test.ts` | load transfer, per-wheel loads, Kamm circle, differential limits, spin onset, coast lockup, compound gain |
| `inertia-math.test.ts` | equivalent rotating mass and the launch value |
| `cruise-math.test.ts` | gear pick, engine load, verdict |
| `brake-math.test.ts` | ideal bias transfer, rear-lock flag, closed-form stopping distance |
| `recovery-math.test.ts` | gear-drop recovery time, monotonicity, `Infinity`/0 boundaries |
| `accel-math.test.ts` | 0–100 / 1/4 mile solver, determinism, split ordering, reaction offset, guards |
| `unit-utils.test.ts` | axes, unit labels, RPM ceiling, power formatting and persistence |
| `accel-performance.test.ts` | host-speed gate on the solver, skipped unless `HAGURUMA_PERF_GATE=1` or `npm run bench` |

### Dyno and measured data (2 suites)

| Suite | Pins |
|:--|:--|
| `dyno-csv.test.ts` | delimiters, kgm/cv conversion, smoothing (Gaussian / Savitzky-Golay / median), resampling to the point cap, invalid-row rejection |
| `efficiency-map.test.ts` | measured efficiency maps: fractional reading, blank/percentage rejection, duplicates, the 256-sample ceiling, the share round trip, and a measured map slowing 0–100 |

### Advanced solvers and tools (2 suites)

| Suite | Pins |
|:--|:--|
| `lap-sequence.test.ts` | command validation, an acceleration → upshift → braking → matched-downshift run, unmatched-downshift drag, `overrev` refusal, limiter hold, handbrake phases |
| `setup-sensitivity.test.ts` | the five finite-difference rows, finite signed metrics, non-mutation of the input, fd/tire sign preservation |

The other new solvers have no dedicated file and are pinned by the release
bundles below: `braking-simulation.ts` and `handbrake-math.ts` and
`corner-advisor.ts` by `release-physics.test.ts`, `telemetry-math.ts`,
`gear-optimizer.ts` and `gpx-track.ts` by `release-telemetry.test.ts`, and
`performance-session.ts` by `release-storage.test.ts`.

### GPS and session recording (1 suite)

| Suite | Pins |
|:--|:--|
| `performance-recorder.test.ts` | recorder lifecycle, single arming, callbacks discarded after stop, speed/time/accuracy-only channels, rejection of rolling starts, weak accuracy, stale or future fixes, and the stop across a missing GPS interval |

### Catalog, presets and configuration data (8 suites)

| Suite | Pins |
|:--|:--|
| `catalog-validation.test.ts` | the catalog contract: required fields, rising ratios, unknown drivetrain enums, `finalDrives` without the stock fd, malformed `drivetrainOptions` |
| `catalog-quality.test.ts` | every raw `src/config/cars/*.json`, filename = `id`, plausibility rules |
| `presets.test.ts` | catalog size, tires/ratios/redlines, gear ordering, road-load data, the Eclipse hero values, unique ids and non-empty labels |
| `diff-presets.test.ts` | differential catalog order, lock ranges, i18n labels, legacy type mapping, `LSD_MODEL_IDS` gating |
| `tire-compounds.test.ts` | compound order, descending treadwear with ascending grip gain, i18n labels, neutral legacy default |
| `drivetrain-eff.test.ts` | layout efficiency defaults stay distinct and in range |
| `quick-spec.test.ts` | quick-spec presets save a curve-valid setup; malformed ratios, unsafe names and out-of-range values are rejected |
| `drivetrain-export.test.ts` | Assetto Corsa `.ini`, BeamNG `.jbeam`, MoTeC/AiM CSV and JSON export shapes, INI round trip |

### Storage, share and persistence (3 suites)

| Suite | Pins |
|:--|:--|
| `share-utils.test.ts` | verbose hash round trips (primary, comparison, running gear, simulation keys, downforce, dyno curve), out-of-range rejection, legacy-safe decoding |
| `share-compact.test.ts` | packed `c` token round trip, length vs the verbose hash, rejection of malformed tokens, verbose fallback with a custom curve |
| `custom-store.test.ts` | gear-list parsing, name slugification, storage fallback, versioned envelope migration |

### UI, graph, setup and i18n (9 suites)

| Suite | Pins |
|:--|:--|
| `canvas-setup.test.ts` | linear plot mapping to the edges and mid-scale |
| `graph-layers.test.ts` | static-layer cache key stability and invalidation, OffscreenCanvas fallback, aero-wall shading range |
| `accordion-height.test.ts` | open-height sync, clearing on close, stale-height recovery, and the stylesheet no longer capping height |
| `theme-events.test.ts` | the dark → oled → light cycle helper (not currently bound to a UI control; the drawer segment sets the theme directly) |
| `gear-colors.test.ts` | the 8-entry palette and wraparound lookup |
| `setup-matrix.test.ts` | wizard matrix coverage, ranked fixes with resolvable copy, dictionary-key existence, guide sections |
| `compare-utils.test.ts` | comparison gear parsing/formatting, top-speed derivation, aligned deltas with `null` on mismatched counts |
| `i18n.test.ts` | identical key sets and non-empty values across languages, `t()` behaviour |
| `qr-svg.test.ts` | QR SVG version scaling and payload rejection |

### Platform contracts (2 suites)

| Suite | Pins |
|:--|:--|
| `pwa-utils.test.ts` | service-worker eligibility, standalone detection, cacheable-request rules |
| `android-manifest.test.ts` | the Android manifest declares coarse/fine location, no background location, GPS not required, non-exported `FileProvider` |

### Release regression bundles (4 suites)

These aggregate checks added for a release; they overlap the groups above and
cover the modules that have no dedicated suite file.

| Suite | Pins |
|:--|:--|
| `release-physics.test.ts` | advanced braking (`braking-simulation`), powertrain map and limiter (`powertrain-math`), handbrake coupling, apex/downshift advice, setup diagnostics, plus property-based speed/RPM and wheel-force checks (300 runs each) |
| `release-storage.test.ts` | backup import/export safety, advanced share extensions, GPS session parsing, and the `performance-session` estimators |
| `release-telemetry.test.ts` | telemetry CSV parsing and inverse dyno, the discrete gearset optimizer, GPX geometry |
| `release-graph.test.ts` | graph window transforms and sharing, auto-fit, snapping, SVG/PNG export geometry, escaping of untrusted SVG metadata |

### What is not covered

No suite exercises a real vehicle, a real dynamometer, a real track, or a real
GPS trace against a surveyed reference, and there is no golden-data regression
against a third-party simulator. `src/config/catalog-quality.ts` states the same
caveat about itself. Treat every physics number as a documented model output, not
as a verified datasheet value.
