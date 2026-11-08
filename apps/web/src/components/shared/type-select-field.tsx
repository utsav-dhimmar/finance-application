import { Field, FieldLabel } from "@finance-application/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";

interface TypeSelectFieldProps {
	idPrefix: string;
	options: Array<{ value: string; label: string }>;
	value: string;
	onChange: (value: string) => void;
}

// The labeled record-type select shared by the entity form dialogs. The
// caller keeps the react-hook-form Controller so form typing stays local.
export function TypeSelectField({
	idPrefix,
	options,
	value,
	onChange,
}: TypeSelectFieldProps) {
	return (
		<Field>
			<FieldLabel htmlFor={`${idPrefix}-type`}>Type</FieldLabel>
			<Select
				items={options}
				value={value}
				onValueChange={(next) => {
					if (next !== null) {
						onChange(next);
					}
				}}
			>
				<SelectTrigger id={`${idPrefix}-type`}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}
