import { Button } from "@finance-application/ui/components/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	useComboboxFilter,
} from "@finance-application/ui/components/combobox";

export interface ComboboxOption {
	value: string;
	label: string;
}

interface ComboboxSelectFieldProps {
	id?: string;
	items: ComboboxOption[];
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyMessage?: string;
	disabled?: boolean;
	invalid?: boolean;
	ariaLabel?: string;
	/** Extra classes for the trigger control; the route keeps styling overrides here. */
	className?: string;
	/** Extra classes for the popup; routes with boxy overrides pass rounded-none here. */
	contentClassName?: string;
}

// The searchable single-select shared by the entity form dialogs and the
// transaction list filters. The caller keeps state ownership (react-hook-form
// Controller or filter state) so form typing stays local. Values are the
// entity IDs from `items`, so callers can swap a Select for this without
// changing what they persist.
export function ComboboxSelectField({
	id,
	items,
	value,
	onValueChange,
	placeholder,
	searchPlaceholder = "Search...",
	emptyMessage = "No options found.",
	disabled = false,
	invalid = false,
	ariaLabel,
	className,
	contentClassName,
}: ComboboxSelectFieldProps) {
	const selected = items.find((item) => item.value === value);
	const filter = useComboboxFilter();

	return (
		<Combobox
			items={items}
			value={selected ?? null}
			onValueChange={(next) => {
				onValueChange(next ? next.value : "");
			}}
			// Item objects are re-created by callers on every render, so match
			// by the stable option id instead of by reference.
			isItemEqualToValue={(itemValue, selectedValue) =>
				itemValue.value === selectedValue.value
			}
			// Explicit case-insensitive "contains" matching; the library default
			// matcher's semantics are not a stable contract.
			filter={(item: ComboboxOption, query: string) =>
				filter.contains(item, query, (option: ComboboxOption) => option.label)
			}
			disabled={disabled}
		>
			<ComboboxTrigger
				id={id}
				aria-label={ariaLabel}
				aria-invalid={invalid || undefined}
				render={
					<Button
						type="button"
						variant="outline"
						className={`w-full justify-between gap-1.5 px-2.5 text-left font-normal ${className ?? ""}`}
					/>
				}
			>
				{selected ? (
					<span className="truncate">{selected.label}</span>
				) : (
					<span className="truncate text-muted-foreground">{placeholder}</span>
				)}
			</ComboboxTrigger>
			<ComboboxContent className={contentClassName}>
				<ComboboxInput
					showTrigger={false}
					placeholder={searchPlaceholder}
					aria-label={ariaLabel ? `Search ${ariaLabel}` : undefined}
				/>
				<ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
				<ComboboxList>
					{(item) => (
						<ComboboxItem key={item.value} value={item}>
							{item.label}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
