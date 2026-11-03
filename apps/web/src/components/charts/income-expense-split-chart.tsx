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

// Config keys are the slice keys — that is how the chart config's tooltip and
// legend resolve their labels. Income rides the theme's chart-1 green,
// expenses the destructive red; both are theme-aware through the vars.
const chartConfig = {
	income: { label: "Income", color: "var(--chart-1)" },
	expenses: { label: "Expenses", color: "var(--destructive)" },
} satisfies ChartConfig;

interface IncomeExpenseSplitChartProps {
	incomeMinor: number;
	expenseMinor: number;
}

interface SplitSlice {
	key: "income" | "expenses";
	name: string;
	value: number;
	fill: string;
}

// The period's income-vs-expenses split as a two-slice donut: what came in
// versus what went out, with exact amounts in the tooltip. Zero-value sides
// simply contribute no slice; a fully empty period renders nothing (the
// dashboard shows its zero state instead).
export function IncomeExpenseSplitChart({
	incomeMinor,
	expenseMinor,
}: IncomeExpenseSplitChartProps) {
	if (incomeMinor === 0 && expenseMinor === 0) {
		return null;
	}
	const allSlices: SplitSlice[] = [
		{
			key: "income",
			name: "Income",
			value: incomeMinor,
			fill: "var(--color-income)",
		},
		{
			key: "expenses",
			name: "Expenses",
			value: expenseMinor,
			fill: "var(--color-expenses)",
		},
	];
	const slices = allSlices.filter((slice) => slice.value !== 0);

	return (
		<ChartContainer
			config={chartConfig}
			className="mx-auto aspect-square max-h-70 w-full"
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
							<ChartLegendContent nameKey="key" className="flex-wrap gap-x-4" />
						}
					/>
				</Pie>
			</PieChart>
		</ChartContainer>
	);
}
