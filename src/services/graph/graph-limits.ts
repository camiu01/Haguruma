/**
 * @file graph-limits.ts
 * @brief Grip-limit curve and wheelspin shading overlay.
 */
import type { PlotFrame } from '../../core/models';
import { toX } from './canvas-setup';

/**
 * @brief Draw the friction-limited drive-force curve.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @param fn Force in newtons from speed in km/h.
 * @param color Stroke color for the curve.
 * @param fill Fill the area under the curve when true.
 * @return void
 */
export const drawGripCurve = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	fn: (vKmh: number) => number,
	color: string,
	fill: boolean = false,
): void => {
	let peak = 1;
	for (let v = 0; v <= frame.maxSpeed; v += 5) {
		const f = fn(v);
		if (Number.isFinite(f) && f > peak) {
			peak = f;
		}
	}
	const yOf = (f: number): number => frame.paddingTop + frame.plotHeight - (Math.max(0, f) / peak) * frame.plotHeight;
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([6, 4]);
	ctx.beginPath();
	let started = false;
	for (let v = 0; v <= frame.maxSpeed; v += 5) {
		const x = toX(frame, v);
		const y = yOf(fn(v));
		if (!started) {
			ctx.moveTo(x, y);
			started = true;
		} else {
			ctx.lineTo(x, y);
		}
	}
	ctx.stroke();
	ctx.setLineDash([]);
	if (fill) {
		ctx.globalAlpha = 0.08;
		ctx.fillStyle = color;
		ctx.lineTo(toX(frame, frame.maxSpeed), frame.paddingTop + frame.plotHeight);
		ctx.lineTo(toX(frame, 0), frame.paddingTop + frame.plotHeight);
		ctx.closePath();
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	ctx.fillStyle = color;
	ctx.font = '10px Inter, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText('GRIP', toX(frame, frame.maxSpeed) - 38, yOf(fn(frame.maxSpeed)) - 8);
	ctx.restore();
};

/**
 * @brief Shade speed bands where engine force exceeds grip.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @param fn Grip limit in newtons from speed in km/h.
 * @param gearForceFn Engine force in newtons from speed in km/h.
 * @return void
 */
export const shadeWheelspin = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	fn: (vKmh: number) => number,
	gearForceFn: (v: number) => number,
): void => {
	ctx.save();
	ctx.fillStyle = 'rgba(239,68,68,0.08)';
	for (let v = 0; v <= frame.maxSpeed; v += 5) {
		let grip = 0;
		let force = 0;
		try {
			grip = fn(v);
			force = gearForceFn(v);
		} catch {
			continue;
		}
		if (Number.isFinite(grip) && Number.isFinite(force) && force > grip) {
			const x = toX(frame, v);
			const next = toX(frame, Math.min(frame.maxSpeed, v + 5));
			ctx.fillRect(x, frame.paddingTop, Math.max(1, next - x), frame.plotHeight);
		}
	}
	ctx.restore();
};
