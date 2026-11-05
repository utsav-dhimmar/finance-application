import type { ComparisonSeries } from "@finance-application/schemas";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@finance-application/ui/components/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatPaise } from "@/lib/money";

const MONTH_ABBREVIATIONS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

// Axis ticks stay compact: "2026-01-05" reads as "5", "2026-03" as "Mar",
// and anything else passes through (e.g. raw labels from future range views).
function shortenTickLabel(label: string): string {
	if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
		return String(Number(label.slice(8, 10)));
	}
	if (/^\d{4}-\d{2}$/.test(label)) {
		return MONTH_ABBREVIATIONS[Number(label.slice(5, 7)) - 1] ?? label;
	}
	return label;
}

// Display-only axis compaction: integer division drops the paise remainder
// on ticks; exact amounts always live in the tooltip and the summary cards.
function rupeeTick(value: number): string {
	return `₹${Math.trunc(value / 100).toLocaleString("en-IN")}`;
}

// Config keys are the series dataKeys — that is how the chart config's
// tooltip and legend resolve their labels. Colors ride the theme's chart-1
// green and destructive red through config vars, so light and dark mode both
// come out right without component-side theming.
const chartConfig = {
	incomeMinor: { label: "Income", color: "var(--chart-1)" },
	expenseMinor: { label: "Expenses", color: "var(--destructive)" },
} satisfies ChartConfig;

interface IncomeExpenseComparisonChartProps {
	// The period's sub-period series (days for a month, months for a year),
	// with empty sub-periods present as zeros.
	series: ComparisonSeries[];
}

// Income-vs-expense bars across the period's natural sub-periods.
export function IncomeExpenseComparisonChart({
	series,
}: IncomeExpenseComparisonChartProps) {
	return (
		<ChartContainer config={chartConfig} className="aspect-auto h-70 w-full">
			<BarChart accessibilityLayer data={series} margin={{ left: 4, right: 4 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="label"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					tickFormatter={shortenTickLabel}
				/>
				<YAxis
					tickLine={false}
					axisLine={false}
					width={64}
					tickFormatter={rupeeTick}
				/>
				<ChartTooltip
					content={
						<ChartTooltipContent
							valueFormatter={(value) => formatPaise(value)}
						/>
					}
				/>
				<Bar
					dataKey="incomeMinor"
					fill="var(--color-incomeMinor)"
					isAnimationActive={false}
				/>
				<Bar
					dataKey="expenseMinor"
					fill="var(--color-expenseMinor)"
					isAnimationActive={false}
				/>
				<ChartLegend content={<ChartLegendContent />} />
			</BarChart>
		</ChartContainer>
	);
}
