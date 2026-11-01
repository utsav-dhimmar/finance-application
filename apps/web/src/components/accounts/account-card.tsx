import type { AccountResponse } from "@finance-application/schemas";
import { Badge } from "@finance-application/ui/components/badge";
import { Button } from "@finance-application/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finance-application/ui/components/card";
import {
	Coins,
	Landmark,
	RotateCcw,
	Wallet,
} from "lucide-react";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-labels";
import { formatPaise } from "@/lib/money";

export interface AccountCardProps {
	account: AccountResponse;
	onEdit: (account: AccountResponse) => void;
	onArchive: (account: AccountResponse) => void;
	onDelete: (account: AccountResponse) => void;
	onRestore: (account: AccountResponse) => void;
}

function getAccountTypeIcon(type: AccountResponse["type"]) {
	switch (type) {
		case "bank":
			return Landmark;
		case "wallet":
			return Wallet;
		default:
			return Coins;
	}
}

export function AccountCard({
	account,
	onEdit,
	onArchive,
	onDelete,
	onRestore,
}: AccountCardProps) {
	const isArchived = account.status === "archived";
	const isDeleted = account.status === "deleted";
	const Icon = getAccountTypeIcon(account.type);

	return (
		<Card className="flex flex-col justify-between transition-all hover:border-border hover:shadow-xs">
			<CardHeader className="space-y-3 pb-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2.5">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-foreground">
							<Icon aria-hidden="true" className="size-4" />
						</div>
						<div>
							<CardTitle className="text-base font-semibold tracking-tight text-foreground">
								{account.name}
							</CardTitle>
							<div className="mt-1 flex flex-wrap items-center gap-1.5">
								<Badge variant="secondary">
									{ACCOUNT_TYPE_LABELS[account.type]}
								</Badge>
								{isArchived && <Badge variant="outline">Archived</Badge>}
								{isDeleted && <Badge variant="outline">Deleted</Badge>}
							</div>
						</div>
					</div>
				</div>

				<div className="pt-1">
					<div className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
						{formatPaise(account.currentBalanceMinor)}
					</div>
					{account.openingBalanceMinor !== account.currentBalanceMinor && (
						<p className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
							opening {formatPaise(account.openingBalanceMinor)}
						</p>
					)}
				</div>
			</CardHeader>

			<CardContent className="flex flex-wrap items-center gap-2 pt-2">
				{account.status === "active" && (
					<>
						<Button
							size="sm"
							variant="outline"
							onClick={() => onEdit(account)}
							className="h-7 text-xs"
						>
							Edit
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => onArchive(account)}
							className="h-7 text-xs"
						>
							Archive
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={() => onDelete(account)}
						>
							Delete
						</Button>
					</>
				)}
				{(isArchived || isDeleted) && (
					<Button
						size="sm"
						variant="outline"
						onClick={() => onRestore(account)}
						className="h-7 gap-1.5 text-xs"
					>
						<RotateCcw aria-hidden="true" className="size-3" />
						Restore
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
