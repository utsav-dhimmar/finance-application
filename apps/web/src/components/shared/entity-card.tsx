import { Badge } from "@finance-application/ui/components/badge";
import { Button } from "@finance-application/ui/components/button";
import {
	CardContent,
	CardTitle,
} from "@finance-application/ui/components/card";
import { RotateCcw, Trash2 } from "lucide-react";

type EntityLifecycleStatus = "active" | "archived" | "deleted";

interface EntityCardTitleProps {
	title: string;
	typeLabel: string;
	isArchived: boolean;
	isDeleted: boolean;
}

// The title-and-badges block shared by the account and category cards: the
// entity name over its type badge plus the archived/deleted status badges.
export function EntityCardTitle({
	title,
	typeLabel,
	isArchived,
	isDeleted,
}: EntityCardTitleProps) {
	return (
		<div>
			<CardTitle className="text-base font-semibold tracking-tight text-foreground">
				{title}
			</CardTitle>
			<div className="mt-1 flex flex-wrap items-center gap-1.5">
				<Badge variant="secondary">{typeLabel}</Badge>
				{isArchived && <Badge variant="outline">Archived</Badge>}
				{isDeleted && <Badge variant="outline">Deleted</Badge>}
			</div>
		</div>
	);
}

interface EntityCardActionsProps {
	status: EntityLifecycleStatus;
	onEdit: () => void;
	onArchive: () => void;
	onDelete: () => void;
	onRestore: () => void;
	// Offered only for trashed entities when provided: permanent deletion is
	// exclusive to trash and always confirmed by the caller.
	onPermanentDelete?: () => void;
}

// The lifecycle action row shared by the account and category cards: edit,
// archive, and delete for active entities; restore and (in trash) permanent
// deletion otherwise.
export function EntityCardActions({
	status,
	onEdit,
	onArchive,
	onDelete,
	onRestore,
	onPermanentDelete,
}: EntityCardActionsProps) {
	const isArchived = status === "archived";
	const isDeleted = status === "deleted";
	return (
		<CardContent className="flex flex-wrap items-center gap-2 pt-2">
			{status === "active" && (
				<>
					<Button
						size="sm"
						variant="outline"
						onClick={onEdit}
						className="h-7 text-xs"
					>
						Edit
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={onArchive}
						className="h-7 text-xs"
					>
						Archive
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
						onClick={onDelete}
					>
						Delete
					</Button>
				</>
			)}
			{(isArchived || isDeleted) && (
				<>
					<Button
						size="sm"
						variant="outline"
						onClick={onRestore}
						className="h-7 gap-1.5 text-xs"
					>
						<RotateCcw aria-hidden="true" className="size-3" />
						Restore
					</Button>
					{isDeleted && onPermanentDelete && (
						<Button
							size="sm"
							variant="outline"
							onClick={onPermanentDelete}
							className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
						>
							<Trash2 aria-hidden="true" className="size-3" />
							Delete forever
						</Button>
					)}
				</>
			)}
		</CardContent>
	);
}
