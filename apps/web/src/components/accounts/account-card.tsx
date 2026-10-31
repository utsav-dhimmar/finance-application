import type { AccountResponse } from "@finance-application/schemas";
import { Badge } from "@finance-application/ui/components/badge";
import { Button } from "@finance-application/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finance-application/ui/components/card";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-labels";
import { formatPaise } from "@/lib/money";

export interface AccountCardProps {
	account: AccountResponse;
	onEdit: (account: AccountResponse) => void;
	onArchive: (account: AccountResponse) => void;
	onDelete: (account: AccountResponse) => void;
	onRestore: (account: AccountResponse) => void;
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
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex flex-wrap items-center gap-2">
					{account.name}
					<Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
					{isArchived && <Badge variant="outline">Archived</Badge>}
					{isDeleted && <Badge variant="outline">Deleted</Badge>}
				</CardTitle>
				<CardDescription className="text-base font-semibold text-foreground">
					{formatPaise(account.currentBalanceMinor)}
					{account.openingBalanceMinor !== account.currentBalanceMinor && (
						<span className="ml-2 text-sm font-normal text-muted-foreground">
							opening {formatPaise(account.openingBalanceMinor)}
						</span>
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-2">
				{account.status === "active" && (
					<>
						<Button size="sm" variant="outline" onClick={() => onEdit(account)}>
							Edit
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => onArchive(account)}
						>
							Archive
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="text-destructive"
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
					>
						Restore
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
