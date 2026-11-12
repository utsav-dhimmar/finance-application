import { Host } from "@expo/ui/jetpack-compose";
import { StyleSheet, Text, View } from "react-native";

import { BoxyButtonCore, BoxyRow } from "@/components/ui";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

type EntityLifecycleStatus = "active" | "archived" | "deleted";

interface EntityBadgesProps {
	typeLabel: string;
	isArchived: boolean;
	isDeleted: boolean;
}

/**
 * The type-and-status badge row shared by the account and category cards:
 * the entity's type badge plus the archived/deleted status badges. Badges
 * are static, so they stay React Native.
 */
export function EntityBadges({
	typeLabel,
	isArchived,
	isDeleted,
}: EntityBadgesProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<View style={styles.badgeRow}>
			<View style={styles.typeBadge}>
				<Text style={styles.typeBadgeText}>{typeLabel}</Text>
			</View>
			{isArchived && (
				<View style={[styles.statusBadge, hairline(c.border)]}>
					<Text style={styles.statusBadgeText}>Archived</Text>
				</View>
			)}
			{isDeleted && (
				<View style={[styles.statusBadge, hairline(c.border)]}>
					<Text style={styles.statusBadgeText}>Deleted</Text>
				</View>
			)}
		</View>
	);
}

interface EntityActionsProps {
	status: EntityLifecycleStatus;
	onEdit: () => void;
	onArchive: () => void;
	onDelete: () => void;
	onRestore: () => void;
}

/**
 * The lifecycle action row shared by the account and category cards (and the
 * activity feed's rows): native Compose buttons inside one host — edit,
 * archive, and delete for active entities; restore otherwise.
 */
export function EntityActions({
	status,
	onEdit,
	onArchive,
	onDelete,
	onRestore,
}: EntityActionsProps) {
	const isArchived = status === "archived";
	const isDeleted = status === "deleted";
	return (
		<Host style={ACTION_ROW_STYLE}>
			<BoxyRow gap={spacing.sm}>
				{status === "active" && (
					<>
						<BoxyButtonCore label="Edit" variant="outline" onPress={onEdit} />
						<BoxyButtonCore
							label="Archive"
							variant="outline"
							onPress={onArchive}
						/>
						<BoxyButtonCore
							label="Delete"
							variant="outlineDestructive"
							onPress={onDelete}
						/>
					</>
				)}
				{(isArchived || isDeleted) && (
					<BoxyButtonCore
						label="Restore"
						variant="outline"
						onPress={onRestore}
					/>
				)}
			</BoxyRow>
		</Host>
	);
}

// Theme-free: the host's own outer margin (RN-side layout of the host).
const ACTION_ROW_STYLE = { marginTop: spacing.lg } as const;

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		actionRow: {
			marginTop: spacing.lg,
		},
		badgeRow: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: spacing.xs,
			marginTop: spacing.xs,
		},
		statusBadge: {
			borderRadius: 0,
			paddingVertical: 2,
			paddingHorizontal: spacing.sm,
		},
		statusBadgeText: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			fontWeight: typography.weightMedium,
		},
		typeBadge: {
			backgroundColor: c.muted,
			borderRadius: 0,
			paddingVertical: 2,
			paddingHorizontal: spacing.sm,
		},
		typeBadgeText: {
			color: c.foreground,
			fontSize: typography.sizeXs,
			fontWeight: typography.weightMedium,
		},
	});
}
