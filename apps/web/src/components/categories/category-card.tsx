import type { CategoryResponse } from "@finance-application/schemas";
import { Card, CardHeader } from "@finance-application/ui/components/card";
import { Tag } from "lucide-react";
import {
	EntityCardActions,
	EntityCardTitle,
} from "@/components/shared/entity-card";
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
		<Card className="flex flex-col justify-between transition-[border-color,box-shadow] hover:border-border hover:shadow-xs">
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
						<EntityCardTitle
							title={category.name}
							typeLabel={CATEGORY_TYPE_LABELS[category.type]}
							isArchived={isArchived}
							isDeleted={isDeleted}
						/>
					</div>
				</div>
				{category.icon && (
					<p className="font-mono text-xs text-muted-foreground">
						icon: {category.icon}
					</p>
				)}
			</CardHeader>

			<EntityCardActions
				status={category.status}
				onEdit={() => onEdit(category)}
				onArchive={() => onArchive(category)}
				onDelete={() => onDelete(category)}
				onRestore={() => onRestore(category)}
				onPermanentDelete={
					onPermanentDelete ? () => onPermanentDelete(category) : undefined
				}
			/>
		</Card>
	);
}
