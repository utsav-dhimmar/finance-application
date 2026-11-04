import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@finance-application/ui/components/tabs";

// The record types the unified Archive and Trash views manage, in tab order.
export type RecordType = "accounts" | "categories" | "transactions" | "transfers";

export const RECORD_TYPES: RecordType[] = [
	"accounts",
	"categories",
	"transactions",
	"transfers",
];

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
	accounts: "Accounts",
	categories: "Categories",
	transactions: "Transactions",
	transfers: "Transfers",
};

interface RecordTypeTabsProps {
	value: RecordType;
	onValueChange: (value: RecordType) => void;
}

// The record-type tab strip shared by the Archive and Trash views: one tab
// per record type, each backed by its own lifecycle slice.
export function RecordTypeTabs({ value, onValueChange }: RecordTypeTabsProps) {
	return (
		<div className="flex items-center">
			<Tabs
				value={value}
				onValueChange={(next) => {
					if (next) {
						onValueChange(next as RecordType);
					}
				}}
			>
				<TabsList className="bg-muted/70 p-1">
					{RECORD_TYPES.map((type) => (
						<TabsTrigger key={type} value={type} className="px-3 text-xs">
							{RECORD_TYPE_LABELS[type]}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
		</div>
	);
}
