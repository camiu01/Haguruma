/**
 * @file setup-matrix.ts
 * @brief Offline troubleshooting matrix: corner phase x handling issue to ranked fixes.
 */
import type { DictKey } from '../i18n/dictionaries';

/** Corner phase where the symptom appears. */
export type CornerPhase = 'entry' | 'mid' | 'exit';

/** Handling symptom reported by the driver. */
export type HandlingIssue = 'understeer' | 'oversteer' | 'transfer' | 'bottoming';

/** Expected side-effect magnitude of a fix. */
export type Severity = 'low' | 'medium' | 'high';

/** Single ranked adjustment proposal pointing at dictionary copy. */
export interface SetupFix {
	/** Priority order, 1 is tried first. */
	rank: number;
	/** Dictionary key for the action title. */
	actionKey: DictKey;
	/** Dictionary key for the rationale. */
	detailKey: DictKey;
	/** Side-effect magnitude. */
	severity: Severity;
	/** Dictionary key for the compromise to watch, when present. */
	tradeoffKey?: DictKey;
}

/** Wizard matrix covering every phase x issue pair. */
export type SetupMatrix = Record<CornerPhase, Record<HandlingIssue, SetupFix[]>>;

/** Ordered phases for the wizard selects. */
export const PHASES: CornerPhase[] = ['entry', 'mid', 'exit'];

/** Ordered issues for the wizard selects. */
export const ISSUES: HandlingIssue[] = ['understeer', 'oversteer', 'transfer', 'bottoming'];

/**
 * @brief Ranked adjustment proposals for all 12 diagnostic combinations.
 * @return Static matrix of dictionary keys, no external sources.
 */
export const SETUP_MATRIX: SetupMatrix = {
	entry: {
		understeer: [
			{ rank: 1, actionKey: 'setup.fix.entry.understeer.1.action', detailKey: 'setup.fix.entry.understeer.1.detail', severity: 'medium', tradeoffKey: 'setup.fix.entry.understeer.1.tradeoff' },
			{ rank: 2, actionKey: 'setup.fix.entry.understeer.2.action', detailKey: 'setup.fix.entry.understeer.2.detail', severity: 'medium', tradeoffKey: 'setup.fix.entry.understeer.2.tradeoff' },
			{ rank: 3, actionKey: 'setup.fix.entry.understeer.3.action', detailKey: 'setup.fix.entry.understeer.3.detail', severity: 'low' },
		],
		oversteer: [
			{ rank: 1, actionKey: 'setup.fix.entry.oversteer.1.action', detailKey: 'setup.fix.entry.oversteer.1.detail', severity: 'medium', tradeoffKey: 'setup.fix.entry.oversteer.1.tradeoff' },
			{ rank: 2, actionKey: 'setup.fix.entry.oversteer.2.action', detailKey: 'setup.fix.entry.oversteer.2.detail', severity: 'medium', tradeoffKey: 'setup.fix.entry.oversteer.2.tradeoff' },
			{ rank: 3, actionKey: 'setup.fix.entry.oversteer.3.action', detailKey: 'setup.fix.entry.oversteer.3.detail', severity: 'medium' },
		],
		transfer: [
			{ rank: 1, actionKey: 'setup.fix.entry.transfer.1.action', detailKey: 'setup.fix.entry.transfer.1.detail', severity: 'medium', tradeoffKey: 'setup.fix.entry.transfer.1.tradeoff' },
			{ rank: 2, actionKey: 'setup.fix.entry.transfer.2.action', detailKey: 'setup.fix.entry.transfer.2.detail', severity: 'low' },
			{ rank: 3, actionKey: 'setup.fix.entry.transfer.3.action', detailKey: 'setup.fix.entry.transfer.3.detail', severity: 'low' },
		],
		bottoming: [
			{ rank: 1, actionKey: 'setup.fix.entry.bottoming.1.action', detailKey: 'setup.fix.entry.bottoming.1.detail', severity: 'high', tradeoffKey: 'setup.fix.entry.bottoming.1.tradeoff' },
			{ rank: 2, actionKey: 'setup.fix.entry.bottoming.2.action', detailKey: 'setup.fix.entry.bottoming.2.detail', severity: 'medium', tradeoffKey: 'setup.fix.entry.bottoming.2.tradeoff' },
			{ rank: 3, actionKey: 'setup.fix.entry.bottoming.3.action', detailKey: 'setup.fix.entry.bottoming.3.detail', severity: 'low' },
		],
	},
	mid: {
		understeer: [
			{ rank: 1, actionKey: 'setup.fix.mid.understeer.1.action', detailKey: 'setup.fix.mid.understeer.1.detail', severity: 'medium', tradeoffKey: 'setup.fix.mid.understeer.1.tradeoff' },
			{ rank: 2, actionKey: 'setup.fix.mid.understeer.2.action', detailKey: 'setup.fix.mid.understeer.2.detail', severity: 'medium', tradeoffKey: 'setup.fix.mid.understeer.2.tradeoff' },
			{ rank: 3, actionKey: 'setup.fix.mid.understeer.3.action', detailKey: 'setup.fix.mid.understeer.3.detail', severity: 'low' },
		],
		oversteer: [
			{ rank: 1, actionKey: 'setup.fix.mid.oversteer.1.action', detailKey: 'setup.fix.mid.oversteer.1.detail', severity: 'medium' },
			{ rank: 2, actionKey: 'setup.fix.mid.oversteer.2.action', detailKey: 'setup.fix.mid.oversteer.2.detail', severity: 'low', tradeoffKey: 'setup.fix.mid.oversteer.2.tradeoff' },
			{ rank: 3, actionKey: 'setup.fix.mid.oversteer.3.action', detailKey: 'setup.fix.mid.oversteer.3.detail', severity: 'medium', tradeoffKey: 'setup.fix.mid.oversteer.3.tradeoff' },
		],
		transfer: [
			{ rank: 1, actionKey: 'setup.fix.mid.transfer.1.action', detailKey: 'setup.fix.mid.transfer.1.detail', severity: 'medium' },
			{ rank: 2, actionKey: 'setup.fix.mid.transfer.2.action', detailKey: 'setup.fix.mid.transfer.2.detail', severity: 'low' },
			{ rank: 3, actionKey: 'setup.fix.mid.transfer.3.action', detailKey: 'setup.fix.mid.transfer.3.detail', severity: 'low' },
		],
		bottoming: [
			{ rank: 1, actionKey: 'setup.fix.mid.bottoming.1.action', detailKey: 'setup.fix.mid.bottoming.1.detail', severity: 'high', tradeoffKey: 'setup.fix.mid.bottoming.1.tradeoff' },
			{ rank: 2, actionKey: 'setup.fix.mid.bottoming.2.action', detailKey: 'setup.fix.mid.bottoming.2.detail', severity: 'medium' },
			{ rank: 3, actionKey: 'setup.fix.mid.bottoming.3.action', detailKey: 'setup.fix.mid.bottoming.3.detail', severity: 'low' },
		],
	},
	exit: {
		understeer: [
			{ rank: 1, actionKey: 'setup.fix.exit.understeer.1.action', detailKey: 'setup.fix.exit.understeer.1.detail', severity: 'medium', tradeoffKey: 'setup.fix.exit.understeer.1.tradeoff' },
			{ rank: 2, actionKey: 'setup.fix.exit.understeer.2.action', detailKey: 'setup.fix.exit.understeer.2.detail', severity: 'medium' },
			{ rank: 3, actionKey: 'setup.fix.exit.understeer.3.action', detailKey: 'setup.fix.exit.understeer.3.detail', severity: 'low' },
		],
		oversteer: [
			{ rank: 1, actionKey: 'setup.fix.exit.oversteer.1.action', detailKey: 'setup.fix.exit.oversteer.1.detail', severity: 'medium', tradeoffKey: 'setup.fix.exit.oversteer.1.tradeoff' },
			{ rank: 2, actionKey: 'setup.fix.exit.oversteer.2.action', detailKey: 'setup.fix.exit.oversteer.2.detail', severity: 'medium' },
			{ rank: 3, actionKey: 'setup.fix.exit.oversteer.3.action', detailKey: 'setup.fix.exit.oversteer.3.detail', severity: 'medium', tradeoffKey: 'setup.fix.exit.oversteer.3.tradeoff' },
		],
		transfer: [
			{ rank: 1, actionKey: 'setup.fix.exit.transfer.1.action', detailKey: 'setup.fix.exit.transfer.1.detail', severity: 'medium' },
			{ rank: 2, actionKey: 'setup.fix.exit.transfer.2.action', detailKey: 'setup.fix.exit.transfer.2.detail', severity: 'medium', tradeoffKey: 'setup.fix.exit.transfer.2.tradeoff' },
			{ rank: 3, actionKey: 'setup.fix.exit.transfer.3.action', detailKey: 'setup.fix.exit.transfer.3.detail', severity: 'low' },
		],
		bottoming: [
			{ rank: 1, actionKey: 'setup.fix.exit.bottoming.1.action', detailKey: 'setup.fix.exit.bottoming.1.detail', severity: 'high' },
			{ rank: 2, actionKey: 'setup.fix.exit.bottoming.2.action', detailKey: 'setup.fix.exit.bottoming.2.detail', severity: 'medium', tradeoffKey: 'setup.fix.exit.bottoming.2.tradeoff' },
			{ rank: 3, actionKey: 'setup.fix.exit.bottoming.3.action', detailKey: 'setup.fix.exit.bottoming.3.detail', severity: 'medium' },
		],
	},
};

/**
 * @brief Read fixes for a phase/issue pair in rank order.
 * @param phase Corner phase selected in the wizard.
 * @param issue Handling issue selected in the wizard.
 * @return Sorted copy of the matching fixes, empty when unknown.
 */
export const getFixes = (phase: CornerPhase, issue: HandlingIssue): SetupFix[] => {
	const byPhase = SETUP_MATRIX[phase];
	if (!byPhase) {
		return [];
	}
	const fixes = byPhase[issue];
	if (!fixes) {
		return [];
	}
	return [...fixes].sort((a, b) => a.rank - b.rank);
};
