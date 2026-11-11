import { Pressable, StyleSheet, Text, View } from "react-native";

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
 * the entity's type badge plus the archived/deleted status badges.
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
 * The lifecycle action row shared by the account and category cards: edit,
 * archive, and delete for active entities; restore otherwise.
 */
export function EntityActions({
	status,
	onEdit,
	onArchive,
	onDelete,
	onRestore,
}: EntityActionsProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const isArchived = status === "archived";
	const isDeleted = status === "deleted";
	return (
		<View style={styles.actionRow}>
			{status === "active" && (
				<>
					<Pressable
						accessibilityRole="button"
						onPress={onEdit}
						style={({ pressed }) => [
							styles.actionButton,
							hairline(c.border),
							pressed && styles.pressed,
						]}
					>
						<Text style={styles.actionText}>Edit</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						onPress={onArchive}
						style={({ pressed }) => [
							styles.actionButton,
							hairline(c.border),
							pressed && styles.pressed,
						]}
					>
						<Text style={styles.actionText}>Archive</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						onPress={onDelete}
						style={({ pressed }) => [
							styles.actionButton,
							hairline(c.border),
							pressed && styles.pressed,
						]}
					>
						<Text style={[styles.actionText, styles.destructiveText]}>
							Delete
						</Text>
					</Pressable>
				</>
			)}
			{(isArchived || isDeleted) && (
				<Pressable
					accessibilityRole="button"
					onPress={onRestore}
					style={({ pressed }) => [
						styles.actionButton,
						hairline(c.border),
						pressed && styles.pressed,
					]}
				>
					<Text style={styles.actionText}>Restore</Text>
				</Pressable>
			)}
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		actionButton: {
			borderRadius: 0,
			paddingVertical: spacing.sm,
			paddingHorizontal: spacing.md,
		},
		actionRow: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: spacing.sm,
			marginTop: spacing.lg,
		},
		actionText: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		badgeRow: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: spacing.xs,
			marginTop: spacing.xs,
		},
		destructiveText: {
			color: c.destructive,
		},
		pressed: {
			opacity: 0.9,
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
