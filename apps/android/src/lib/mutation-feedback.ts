import { toast } from "sonner-native";

// Mutation toasts fire from the hooks layer so every screen gets the same
// feedback without re-implementing it. Success copy is a confirmation only;
// error copy always comes from the domain service's message mapping, so raw
// errors, cookies, and tokens never reach the UI.
export function notifyMutationSuccess(message: string): void {
	toast.success(message);
}

export function notifyMutationError(
	error: unknown,
	getErrorMessage: (error: unknown, fallback: string) => string,
	fallback: string,
): void {
	toast.error(getErrorMessage(error, fallback));
}
