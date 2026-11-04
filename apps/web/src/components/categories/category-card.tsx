import type { CategoryResponse } from "@finance-application/schemas";
import { Badge } from "@finance-application/ui/components/badge";
import { Button } from "@finance-application/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finance-application/ui/components/card";
import { RotateCcw, Tag, Trash2 } from "lucide-react";
import { CATEGORY_TYPE_LABELS } from "@/lib/category-labels";

export interface CategoryCardProps {
	category: CategoryResponse;
	onEdit: (category: CategoryResponse) => void;
	onArchive: (category: CategoryResponse) => void;
	onDelete: (category: CategoryResponse) => void;
	onRestore: (category: CategoryResponse) => void;
	// Offered only for trashed categories when provided: permanent deletion is
	// exclusive to trash and always confirmed by the caller.
	onPermanentDelete?: (category: CategoryResponse) => void;
}

export function CategoryCard({
	category,
	onEdit,
	onArchive,
	onDelete,
	onRestore,
	onPermanentDelete,
}: CategoryCardProps) {
	const isArchived = category.status === "archived";
	const isDeleted = category.status === "deleted";

	return (
		<Card className="flex flex-col justify-between transition-all hover:border-border hover:shadow-xs">
			<CardHeader className="space-y-3 pb-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2.5">
						<div
							className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/80 text-foreground"
							style={
								category.color
									? { backgroundColor: `${category.color}1a` }
									: undefined
							}
						>
							<Tag
								aria-hidden="true"
								className="size-4"
								style={category.color ? { color: category.color } : undefined}
							/>
						</div>
						<div>
							<CardTitle className="text-base font-semibold tracking-tight text-foreground">
								{category.name}
							</CardTitle>
							<div className="mt-1 flex flex-wrap items-center gap-1.5">
								<Badge variant="secondary">
									{CATEGORY_TYPE_LABELS[category.type]}
								</Badge>
								{isArchived && <Badge variant="outline">Archived</Badge>}
								{isDeleted && <Badge variant="outline">Deleted</Badge>}
							</div>
						</div>
					</div>
				</div>
				{category.icon && (
					<p className="font-mono text-xs text-muted-foreground">
						icon: {category.icon}
					</p>
				)}
			</CardHeader>

			<CardContent className="flex flex-wrap items-center gap-2 pt-2">
				{category.status === "active" && (
					<>
						<Button
							size="sm"
							variant="outline"
							onClick={() => onEdit(category)}
							className="h-7 text-xs"
						>
							Edit
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => onArchive(category)}
							className="h-7 text-xs"
						>
							Archive
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={() => onDelete(category)}
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
							onClick={() => onRestore(category)}
							className="h-7 gap-1.5 text-xs"
						>
							<RotateCcw aria-hidden="true" className="size-3" />
							Restore
						</Button>
						{isDeleted && onPermanentDelete && (
							<Button
								size="sm"
								variant="outline"
								onClick={() => onPermanentDelete(category)}
								className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
							>
								<Trash2 aria-hidden="true" className="size-3" />
								Delete forever
							</Button>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
