import { Button } from "@finance-application/ui/components/button";
import { Component, type ReactNode } from "react";

interface ChartSlotBoundaryProps {
	// A rejected chart chunk import must not unmount the whole dashboard
	// route. The parent re-creates the lazy chart components on retry and
	// remounts this boundary by changing its key (period or retry
	// generation), which resets the failed state.
	onRetry: () => void;
	children: ReactNode;
}

interface ChartSlotBoundaryState {
	failed: boolean;
}

// Slot-local error boundary around one lazy chart. React reuses a lazy
// component's rejected payload forever, so retrying re-creates the
// components themselves (see the dashboard's chart set state) and remounts
// this boundary via resetKey.
export class ChartSlotBoundary extends Component<
	ChartSlotBoundaryProps,
	ChartSlotBoundaryState
> {
	override state: ChartSlotBoundaryState = { failed: false };

	static getDerivedStateFromError(): ChartSlotBoundaryState {
		return { failed: true };
	}

	override render() {
		if (this.state.failed) {
			return (
				<div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 p-8 text-center">
					<p className="text-sm text-muted-foreground">
						Could not load the chart.
					</p>
					<Button variant="outline" size="sm" onClick={this.props.onRetry}>
						Retry
					</Button>
				</div>
			);
		}
		return this.props.children;
	}
}
