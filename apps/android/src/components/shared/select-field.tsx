import { BoxyDropdownField, type SelectOption } from "@/components/ui";

export type { SelectOption };

export interface SelectFieldProps {
	/** Label text; rendered above the native menu trigger in the boxy style. */
	label: string;
	options: SelectOption[];
	value: string;
	placeholder?: string;
	onValueChange: (value: string) => void;
}

/**
 * The boxy single-select shared by the filter row and the form dialogs: a
 * labeled field backed by the native Compose dropdown menu (see
 * src/components/ui). The dropdown is uncontrolled on the JS side — the
 * native layer opens it from the trigger press — so there is no open state.
 */
export function SelectField({
	label,
	options,
	value,
	placeholder = "Select",
	onValueChange,
}: SelectFieldProps) {
	return (
		<BoxyDropdownField
			label={label}
			options={options}
			value={value}
			placeholder={placeholder}
			onValueChange={onValueChange}
		/>
	);
}
