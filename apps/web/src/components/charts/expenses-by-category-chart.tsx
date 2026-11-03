import type { CategoryBreakdownItem } from "@finance-application/schemas";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@finance-application/ui/components/chart";
import { Pie, PieChart } from "recharts";
import { formatPaise } from "@/lib/money";

const PIE_TOP_N = 5;

interface ExpensesByCategoryChartProps {
	// The period's expense breakdown, largest total first (the API's order).
	breakdown: CategoryBreakdownItem[];
}

interface CategorySlice {
	// The config key: the category id, or "other" for the tail bucket.
	key: string;
	name: string;
	value: number;
	fill: string;
}

// Expense-by-category donut. The top categories get individual palette slots
// and the tail collapses into an explicit "Other" slice; the legend and
// tooltip resolve labels from the chart config, so color never encodes
// financial data alone — the breakdown list carries the exact figures.
export function ExpensesByCategoryChart({
	breakdown,
}: ExpensesByCategoryChartProps) {
	if (breakdown.length === 0) {
		return null;
	}

	const config: ChartConfig = {};
	const top = breakdown.slice(0, PIE_TOP_N);
	const slices: CategorySlice[] = top.map((item, index) => {
		const name = item.categoryName ?? "Unavailable";
		config[item.categoryId] = {
			label: name,
			color: `var(--chart-${(index % PIE_TOP_N) + 1})`,
		};
		return {
			key: item.categoryId,
			name,
			value: item.amountMinor,
			fill: `var(--color-${item.categoryId})`,
		};
	});
	if (breakdown.length > PIE_TOP_N) {
		const otherTotal = breakdown
			.slice(PIE_TOP_N)
			.reduce((sum, item) => sum + item.amountMinor, 0);
		config.other = { label: "Other", color: "var(--muted-foreground)" };
		slices.push({
			key: "other",
			name: "Other",
			value: otherTotal,
			fill: "var(--color-other)",
		});
	}

	return (
		<ChartContainer
			config={config}
			className="mx-auto aspect-square max-h-[280px] w-full"
		>
			<PieChart>
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelKey="key"
							nameKey="key"
							valueFormatter={(value) => formatPaise(value)}
						/>
					}
				/>
				<Pie
					data={slices}
					dataKey="value"
					nameKey="key"
					innerRadius={55}
					strokeWidth={5}
					isAnimationActive={false}
				>
					<ChartLegend
						content={
							<ChartLegendContent
								nameKey="key"
								className="flex-wrap gap-x-4 gap-y-1"
							/>
						}
					/>
				</Pie>
			</PieChart>
		</ChartContainer>
	);
}
