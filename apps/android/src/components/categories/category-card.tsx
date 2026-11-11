import type { CategoryResponse } from "@finance-application/schemas";
import { StyleSheet, Text, View } from "react-native";

import {
	EntityActions,
	EntityBadges,
} from "@/components/shared/entity-card-parts";
import { CATEGORY_TYPE_LABELS } from "@/lib/category-labels";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface CategoryCardProps {
	category: CategoryResponse;
	onEdit: (category: CategoryResponse) => void;
	onArchive: (category: CategoryResponse) => void;
	onDelete: (category: CategoryResponse) => void;
	onRestore: (category: CategoryResponse) => void;
}

/** One category card: swatch, name, type and status badges, icon, actions. */
export function CategoryCard({
	category,
	onEdit,
	onArchive,
	onDelete,
	onRestore,
}: CategoryCardProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<View style={[styles.card, hairline(c.border)]}>
			<View style={styles.titleRow}>
				{category.color ? (
					// testID marks the swatch for component tests; the color itself
					// is decorative, so it carries no accessibility label.
					<View
						testID="category-color-swatch"
						style={[
							styles.swatch,
							hairline(c.border),
							{ backgroundColor: `${category.color}1a` },
						]}
					/>
				) : null}
				<View style={styles.titleText}>
					<Text style={styles.name}>{category.name}</Text>
					<EntityBadges
						typeLabel={CATEGORY_TYPE_LABELS[category.type]}
						isArchived={category.status === "archived"}
						isDeleted={category.status === "deleted"}
					/>
				</View>
			</View>
			{category.icon ? (
				<Text style={styles.icon}>icon: {category.icon}</Text>
			) : null}
			<EntityActions
				status={category.status}
				onEdit={() => {
					onEdit(category);
				}}
				onArchive={() => {
					onArchive(category);
				}}
				onDelete={() => {
					onDelete(category);
				}}
				onRestore={() => {
					onRestore(category);
				}}
			/>
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		card: {
			backgroundColor: c.background,
			padding: spacing.lg,
		},
		icon: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: spacing.sm,
		},
		name: {
			color: c.foreground,
			fontSize: typography.sizeMd,
			fontWeight: typography.weightBold,
		},
		swatch: {
			borderRadius: 0,
			height: 32,
			width: 32,
		},
		titleRow: {
			flexDirection: "row",
			gap: spacing.md,
		},
		titleText: {
			flexShrink: 1,
		},
	});
}
